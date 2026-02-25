/**
 * Script de migración: cifra los accountNumber existentes en texto plano.
 * Se puede correr múltiples veces de forma segura (es idempotente — salta los ya cifrados).
 *
 * Uso:
 *   npx tsx scripts/encrypt-account-numbers.ts
 *
 * Requisito: ENCRYPTION_KEY debe estar en .env antes de correr este script.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encrypt, isEncrypted } from '../lib/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Migración: Cifrado de números de cuenta ===\n');

  if (!process.env.ENCRYPTION_KEY) {
    console.error('ERROR: ENCRYPTION_KEY no está definida en .env');
    console.error('Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  const accounts = await prisma.bankAccount.findMany({
    select: { id: true, accountNumber: true, referenceName: true },
  });

  console.log(`Cuentas encontradas: ${accounts.length}\n`);

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of accounts) {
    if (isEncrypted(account.accountNumber)) {
      console.log(`  [SKIP] ${account.referenceName} — ya cifrada`);
      skipped++;
      continue;
    }

    try {
      const encryptedNumber = encrypt(account.accountNumber);
      await prisma.bankAccount.update({
        where: { id: account.id },
        data: { accountNumber: encryptedNumber },
      });
      console.log(`  [OK]   ${account.referenceName} — cifrada correctamente`);
      encrypted++;
    } catch (err) {
      console.error(`  [ERR]  ${account.referenceName} — error: ${err}`);
      errors++;
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Cifradas:  ${encrypted}`);
  console.log(`  Saltadas:  ${skipped} (ya estaban cifradas)`);
  console.log(`  Errores:   ${errors}`);

  if (errors > 0) {
    console.error('\nHubo errores. Revisa los registros anteriores.');
    process.exit(1);
  } else {
    console.log('\nMigración completada exitosamente.');
  }
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
