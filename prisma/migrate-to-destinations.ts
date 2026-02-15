import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Migrating Packages to Destinations ===\n');

  // 1. Get all packages with their departures
  const packages = await prisma.package.findMany({
    include: { departures: true },
  });

  console.log(`Found ${packages.length} packages to migrate.\n`);

  // Map: packageId -> destinationId
  const packageToDestination: Record<string, string> = {};

  for (const pkg of packages) {
    const destination = await prisma.destination.create({
      data: {
        tenantId: pkg.tenantId,
        name: pkg.name,
        description: pkg.description || '',
      },
    });
    packageToDestination[pkg.id] = destination.id;
    console.log(`  Created destination "${destination.name}" (${destination.id}) from package ${pkg.id}`);
  }

  console.log(`\nCreated ${Object.keys(packageToDestination).length} destinations.\n`);

  // 2. Update all bookings with destination data from their departure
  const bookings = await prisma.booking.findMany({
    include: {
      departure: {
        include: { package: true },
      },
    },
  });

  console.log(`Found ${bookings.length} bookings to migrate.\n`);

  let updated = 0;
  let skipped = 0;

  for (const booking of bookings) {
    if (!booking.departure) {
      console.log(`  SKIP booking ${booking.id} - no departure found`);
      skipped++;
      continue;
    }

    const destinationId = packageToDestination[booking.departure.packageId];
    if (!destinationId) {
      console.log(`  SKIP booking ${booking.id} - no destination for package ${booking.departure.packageId}`);
      skipped++;
      continue;
    }

    // Calculate numAdults/numChildren from netCost
    let numAdults = 1;
    let numChildren = 0;
    const priceAdult = booking.departure.priceAdult;
    const priceChild = booking.departure.priceChild;

    if (booking.netCost > 0 && priceAdult > 0) {
      // Try to reverse-engineer passenger counts
      // netCost = (priceAdult * numAdults) + (priceChild * numChildren)
      numAdults = Math.max(1, Math.round(booking.netCost / priceAdult));

      // Check if there are children
      if (priceChild > 0) {
        const remainingAfterAdults = booking.netCost - (priceAdult * numAdults);
        if (remainingAfterAdults > 0) {
          numChildren = Math.round(remainingAfterAdults / priceChild);
          // Re-verify
          if ((priceAdult * numAdults + priceChild * numChildren) !== booking.netCost) {
            // Try different combinations
            for (let a = 1; a <= 10; a++) {
              for (let c = 0; c <= 10; c++) {
                if (priceAdult * a + priceChild * c === booking.netCost) {
                  numAdults = a;
                  numChildren = c;
                  break;
                }
              }
            }
          }
        }
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        destinationId,
        departureDate: booking.departure.departureDate,
        returnDate: booking.departure.returnDate,
        priceAdult,
        priceChild,
        numAdults,
        numChildren,
      },
    });

    updated++;
    console.log(`  Updated booking ${booking.id} -> destination ${destinationId}, ${numAdults}A/${numChildren}C`);
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Destinations created: ${Object.keys(packageToDestination).length}`);
  console.log(`  Bookings updated: ${updated}`);
  console.log(`  Bookings skipped: ${skipped}`);

  // 3. Validate
  const nullDestination = await prisma.booking.count({
    where: { destinationId: null },
  });
  console.log(`\n  Bookings with NULL destinationId: ${nullDestination}`);
  if (nullDestination > 0) {
    console.log('  WARNING: Some bookings still have no destination!');
  } else {
    console.log('  All bookings migrated successfully.');
  }

  // 4. Migrate permissions: replace "paquetes" with "destinos" in all roles
  const roles = await prisma.role.findMany();
  let rolesUpdated = 0;
  for (const role of roles) {
    const perms = role.permissions as string[];
    if (perms.includes('paquetes')) {
      const newPerms = perms.map((p: string) => (p === 'paquetes' ? 'destinos' : p));
      await prisma.role.update({
        where: { id: role.id },
        data: { permissions: newPerms },
      });
      rolesUpdated++;
      console.log(`  Updated role "${role.name}" permissions: paquetes -> destinos`);
    }
  }
  console.log(`  Roles updated: ${rolesUpdated}`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
