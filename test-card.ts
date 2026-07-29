import { prisma } from './src/lib/prisma';

async function createTestCard() {
  try {
    const newItem = await prisma.storeItem.create({
      data: {
        title: 'Master Biology Class 12',
        classLabel: 'CLASS 12 BIO',
        badge: 'NEW',
        rating: '5.0',
        enrolled: '42',
        instructor: 'Gourab',
        price: '999',
        color: '#2563EB',
        whatsappNumber: '919876543210',
        whatsappText: 'Hello, I want to purchase the Test Master Course!'
      }
    });
    console.log('Successfully created test card:', newItem);
  } catch (err) {
    console.error('Error creating card:', err);
  } finally {
    // await prisma.$disconnect();
  }
}

createTestCard();
