require('dotenv').config();
const prisma = require('../src/config/database');

async function main() {
  try {
    // Get an application
    const app = await prisma.application.findFirst();
    if (!app) {
      console.log('No application found');
      return;
    }
    
    console.log('Found app:', app.id);
    
    const status = 'UNDER_REVIEW';
    const reason = 'Test update';
    const userId = (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }))?.id;
    
    if (!userId) {
      console.log('No super admin found');
      return;
    }

    console.log('Updating app status...');
    
    const updatedApplication = await prisma.application.update({
      where: { id: app.id },
      data: {
        status,
        lastStatusChangeAt: new Date(),
      },
      include: {
        client: true,
        consultant: true,
      },
    });
    
    console.log('Updated app in DB');

    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: app.id,
        oldStatus: app.status,
        newStatus: status,
        changedById: userId,
        reason,
      },
    });
    
    console.log('Created history record');
    
    console.log('Success!');
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
