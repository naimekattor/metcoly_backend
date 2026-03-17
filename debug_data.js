require('dotenv').config({ path: '.env' });
const prisma = require('./src/config/database');
const fs = require('fs');

async function debug() {
  try {
    const apps = await prisma.application.findMany({
      include: { client: true, service: true }
    });
    const bookings = await prisma.booking.findMany({
      include: { client: true, service: true }
    });
    
    const result = {
      appCount: apps.length,
      bookingCount: bookings.length,
      apps: apps.slice(0, 2),
      bookings: bookings.slice(0, 2)
    };
    
    fs.writeFileSync('debug_output.json', JSON.stringify(result, null, 2));
    console.log('Debug info written to debug_output.json');
  } catch (error) {
    fs.writeFileSync('debug_error.txt', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
