// @ts-nocheck
import prisma from '../lib/prisma';

async function addLecture() {
  const title = "The Living World | Biology Class 11";
  const videoId = "6XI6dFWjLm8";

  console.log(`Adding lecture: ${title} (Video ID: ${videoId})...`);

  // Check if it already exists
  const existing = await prisma.freeLecture.findFirst({
    where: { videoId }
  });

  if (existing) {
    console.log('Lecture already exists in the database.');
    return;
  }

  await prisma.freeLecture.create({
    data: {
      title,
      videoId,
    }
  });

  console.log('Lecture added successfully!');
}

addLecture()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
