require('dotenv').config();
const prisma = require('../src/config/database');

async function main() {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'application_status_history'
    `);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
