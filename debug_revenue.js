require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const totalPaidRevenue = await prisma.payment.aggregate({
    where: { status: 'PAID' },
    _sum: { amount: true },
  });

  const totalPendingRevenue = await prisma.payment.aggregate({
    where: { status: 'PENDING' },
    _sum: { amount: true },
  });

  const paymentsCount = await prisma.payment.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true }
  });

  const services = await prisma.service.findMany({
    select: { name: true, basePrice: true, currency: true }
  });

  console.log('--- Revenue Stats ---');
  console.log('Total PAID Revenue:', totalPaidRevenue._sum.amount);
  console.log('Total PENDING Revenue:', totalPendingRevenue._sum.amount);
  console.log('\n--- Payments Breakdown ---');
  console.log(JSON.stringify(paymentsCount, null, 2));
  console.log('\n--- Services ---');
  console.log(JSON.stringify(services, null, 2));

  // Check for any payments without status PAID but that might have been paid
  const recentPending = await prisma.payment.findMany({
    where: { status: 'PENDING' },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n--- Recent Pending Payments ---');
  console.log(JSON.stringify(recentPending, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
