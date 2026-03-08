require('dotenv').config();
const prisma = require('./src/config/database');

async function main() {
    const services = await prisma.service.findMany();
    console.log(JSON.stringify(services, null, 2));
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
