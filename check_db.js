require('dotenv').config({ path: '.env' });
const prisma = require('./src/config/database');

async function checkData() {
  try {
    const userCount = await prisma.user.count();
    const appCount = await prisma.application.count();
    const bookingCount = await prisma.booking.count();
    const serviceCount = await prisma.service.count();

    console.log('User Count:', userCount);
    console.log('Application Count:', appCount);
    console.log('Booking Count:', bookingCount);
    console.log('Service Count:', serviceCount);

    if (appCount > 0) {
      const apps = await prisma.application.findMany({ 
        take: 5,
        include: { client: true, service: true }
      });
      console.log('Recent Applications:', JSON.stringify(apps, null, 2));
    }

    if (bookingCount > 0) {
      const bookings = await prisma.booking.findMany({
        take: 5,
        include: { client: true, service: true }
      });
      console.log('Recent Bookings:', JSON.stringify(bookings, null, 2));
    }

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
