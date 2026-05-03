require('dotenv').config();
const prisma = require('./src/config/database.js');

async function main() {
  const user = await prisma.user.findFirst();
  if(!user) return console.log('No user');
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        address: 'test',
        emailNotifications: true,
        displayLanguage: 'en'
      },
      select: {
        address: true,
        emailNotifications: true,
        displayLanguage: true
      }
    });
    console.log('Success', updated);
  } catch(e) {
    console.error('Error', e);
  }
}
main().then(() => process.exit(0));
