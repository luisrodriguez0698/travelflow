import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_MODULES = [
  'dashboard', 'clientes', 'paquetes', 'temporadas',
  'ventas', 'proveedores', 'bancos', 'configuracion', 'usuarios',
];

const DEFAULT_ROLES = [
  { name: 'Admin', permissions: ALL_MODULES, isDefault: true },
  { name: 'Agente', permissions: ['dashboard', 'ventas', 'clientes', 'paquetes', 'temporadas'], isDefault: true },
  { name: 'Contador', permissions: ['dashboard', 'bancos', 'ventas'], isDefault: true },
];

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    // Check if tenant already has roles
    const existingRoles = await prisma.role.count({ where: { tenantId: tenant.id } });

    if (existingRoles > 0) {
      console.log(`Tenant "${tenant.name}" already has ${existingRoles} role(s), skipping role creation`);
    } else {
      console.log(`Creating default roles for tenant "${tenant.name}"...`);
      for (const roleData of DEFAULT_ROLES) {
        await prisma.role.create({
          data: {
            tenantId: tenant.id,
            name: roleData.name,
            permissions: roleData.permissions,
            isDefault: roleData.isDefault,
          },
        });
      }
      console.log(`  Created 3 default roles`);
    }

    // Assign Admin role to users without roleId
    const adminRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: 'Admin' },
    });

    if (adminRole) {
      const usersWithoutRole = await prisma.user.findMany({
        where: { tenantId: tenant.id, roleId: null },
      });

      for (const user of usersWithoutRole) {
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId: adminRole.id, role: 'Admin' },
        });
        console.log(`  Assigned Admin role to user "${user.email}"`);
      }
    }
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
