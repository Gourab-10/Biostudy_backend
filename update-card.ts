import { prisma } from './src/lib/prisma';

async function updateTestCard() {
  try {
    const updated = await prisma.storeItem.updateMany({
      data: {
        whatsappNumber: '918961826680',
        whatsappText: ''
      }
    });
    console.log('Successfully updated test card(s):', updated.count);
  } catch (err) {
    console.error('Error updating card:', err);
  } finally {
    // await prisma.$disconnect();
  }
}

updateTestCard();
