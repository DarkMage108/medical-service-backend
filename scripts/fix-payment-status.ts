import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing payment status...');

  // Update all WAITING_DELIVERY to PAID
  const result = await prisma.$executeRaw`
    UPDATE doses
    SET "paymentStatus" = 'PAID'::"PaymentStatus"
    WHERE "paymentStatus" = 'WAITING_DELIVERY'::"PaymentStatus"
  `;

  console.log(`Updated ${result} doses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
