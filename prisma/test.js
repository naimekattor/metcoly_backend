const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`SELECT 1`;
  console.log("Connection OK:", result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());