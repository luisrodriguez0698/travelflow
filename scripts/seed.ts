import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test tenant (agency)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Agencia Demo',
      email: 'contacto@agenciademo.com',
      phone: '9611234567',
      address: 'Avenida Principal No. 123, Col. Centro',
    },
  });

  console.log('✅ Created tenant:', tenant.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash('johndoe123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      password: hashedPassword,
      name: 'Admin User',
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create sample clients
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        fullName: 'María García López',
        ine: 'GALO850315MCSRPR09',
        curp: 'GALO850315MCSRPR09',
        phone: '9611234567',
        email: 'maria.garcia@email.com',
        birthDate: new Date('1985-03-15'),
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Carlos Hernández Pérez',
        ine: 'HEPC900520HCSRRR04',
        curp: 'HEPC900520HCSRRR04',
        phone: '9619876543',
        email: 'carlos.hernandez@email.com',
        birthDate: new Date('1990-05-20'),
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        fullName: 'Ana Martínez Rodríguez',
        ine: 'MARA881210MCSRDN02',
        curp: 'MARA881210MCSRDN02',
        phone: '9615551234',
        email: 'ana.martinez@email.com',
        birthDate: new Date('1988-12-10'),
      },
    }),
  ]);

  console.log('✅ Created', clients.length, 'sample clients');

  // Create sample packages
  const package1 = await prisma.package.create({
    data: {
      tenantId: tenant.id,
      name: 'Cancún - Riviera Maya',
      description: 'Disfruta de las hermosas playas del Caribe mexicano en un resort todo incluido de lujo.',
      images: [],
      servicesIncluded: JSON.stringify([
        'Traslados aeropuerto-hotel-aeropuerto',
        'Habitación de lujo con vista al mar',
        'Plan todo incluido (comida y bebidas)',
        'Acceso a todas las instalaciones del resort',
        'Actividades acuáticas no motorizadas',
        'Entretenimiento nocturno',
        'Wi-Fi gratuito',
        'Gimnasio y spa',
      ]),
      servicesNotIncluded: JSON.stringify([
        'Vuelos',
        'Tours opcionales',
        'Servicios de spa (masajes y tratamientos)',
        'Buceo certificado',
        'Comidas en restaurantes especiales',
        'Propinas',
      ]),
    },
  });

  const package2 = await prisma.package.create({
    data: {
      tenantId: tenant.id,
      name: 'Los Cabos - Baja California',
      description: 'Experiencia única en el Mar de Cortés con actividades acuáticas y golf de clase mundial.',
      images: [],
      servicesIncluded: JSON.stringify([
        'Traslados aeropuerto-hotel-aeropuerto',
        'Habitación de lujo',
        'Desayuno buffet',
        'Acceso a piscinas y playa',
        'Actividades recreativas',
        'Wi-Fi gratuito',
      ]),
      servicesNotIncluded: JSON.stringify([
        'Vuelos',
        'Comidas y cenas',
        'Tours de pesca deportiva',
        'Campo de golf',
        'Snorkel y buceo',
        'Propinas',
      ]),
    },
  });

  console.log('✅ Created 2 sample packages');

  // Create departures for packages
  const departure1 = await prisma.packageDeparture.create({
    data: {
      packageId: package1.id,
      departureDate: new Date('2026-06-15'),
      returnDate: new Date('2026-06-19'),
      priceAdult: 18500,
      priceChild: 12000,
      availableSlots: 30,
    },
  });

  const departure2 = await prisma.packageDeparture.create({
    data: {
      packageId: package1.id,
      departureDate: new Date('2026-07-20'),
      returnDate: new Date('2026-07-24'),
      priceAdult: 22500,
      priceChild: 15000,
      availableSlots: 25,
    },
  });

  const departure3 = await prisma.packageDeparture.create({
    data: {
      packageId: package2.id,
      departureDate: new Date('2026-08-10'),
      returnDate: new Date('2026-08-14'),
      priceAdult: 25000,
      priceChild: 18000,
      availableSlots: 20,
    },
  });

  console.log('✅ Created 3 sample departures');

  // Create a sample booking with payment plan
  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: clients[0].id,
      packageId: package1.id,
      departureId: departure1.id,
      totalPrice: 18500,
      paymentType: 'CREDIT',
      downPayment: 3000,
      numberOfPayments: 10,
      status: 'ACTIVE',
      notes: 'Cliente requiere habitación en piso alto',
    },
  });

  console.log('✅ Created sample booking');

  // Create payment plan (10 biweekly payments)
  const remainingBalance = booking.totalPrice - booking.downPayment;
  const paymentAmount = Math.floor(remainingBalance / booking.numberOfPayments);
  const lastPaymentAmount = remainingBalance - (paymentAmount * (booking.numberOfPayments - 1));

  const paymentPlans = [];
  const startDate = new Date('2026-02-15');

  for (let i = 0; i < booking.numberOfPayments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(startDate.getDate() + (i * 15)); // Every 15 days

    const amount = i === booking.numberOfPayments - 1 ? lastPaymentAmount : paymentAmount;
    const isPaid = i < 2; // Mark first 2 payments as paid

    paymentPlans.push({
      bookingId: booking.id,
      paymentNumber: i + 1,
      dueDate,
      amount,
      status: isPaid ? 'PAID' : 'PENDING',
      paidDate: isPaid ? new Date() : null,
      paidAmount: isPaid ? amount : 0,
    });
  }

  await prisma.paymentPlan.createMany({
    data: paymentPlans,
  });

  console.log('✅ Created payment plan with', paymentPlans.length, 'payments');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
