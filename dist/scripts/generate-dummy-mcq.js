"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const prisma_1 = __importDefault(require("../lib/prisma"));
async function generateDummyMCQs() {
    console.log('Generating dummy MCQs...');
    // Fetch Chapter 1
    const chapter = await prisma_1.default.chapter.findFirst({
        where: { number: '1', classNum: 11 },
    });
    if (!chapter) {
        console.error('Chapter 1 (Class 11) not found in the database. Please make sure the seed script has run.');
        process.exit(1);
    }
    const dummyQuestions = [
        {
            chapterId: chapter.id,
            classNum: 11,
            text: 'What is the basic unit of life?',
            options: JSON.stringify(['Atom', 'Cell', 'Tissue', 'Organ']),
            correctIndex: 1,
            explanation: 'The cell is the basic structural and functional unit of all living organisms.',
        },
        {
            chapterId: chapter.id,
            classNum: 11,
            text: 'Which of the following is NOT a characteristic of all living organisms?',
            options: JSON.stringify(['Metabolism', 'Growth', 'Reproduction', 'Photosynthesis']),
            correctIndex: 3,
            explanation: 'Photosynthesis is a characteristic of plants and some bacteria, not all living organisms (like animals).',
        },
        {
            chapterId: chapter.id,
            classNum: 11,
            text: 'Who is known as the father of Taxonomy?',
            options: JSON.stringify(['Charles Darwin', 'Gregor Mendel', 'Carolus Linnaeus', 'Louis Pasteur']),
            correctIndex: 2,
            explanation: 'Carolus Linnaeus is known as the father of modern taxonomy for his system of binomial nomenclature.',
        },
        {
            chapterId: chapter.id,
            classNum: 11,
            text: 'The scientific name of humans is Homo sapiens. What does "Homo" represent?',
            options: JSON.stringify(['Species', 'Genus', 'Family', 'Order']),
            correctIndex: 1,
            explanation: 'In binomial nomenclature, the first word represents the Genus and the second word represents the specific epithet (species).',
        },
        {
            chapterId: chapter.id,
            classNum: 11,
            text: 'Which kingdom includes organisms that are multicellular, eukaryotic, and heterotrophic?',
            options: JSON.stringify(['Monera', 'Protista', 'Plantae', 'Animalia']),
            correctIndex: 3,
            explanation: 'Kingdom Animalia consists of multicellular, eukaryotic organisms that consume organic material (heterotrophic).',
        }
    ];
    // Delete existing questions for this chapter to avoid duplicates during testing
    await prisma_1.default.quizQuestion.deleteMany({
        where: { chapterId: chapter.id }
    });
    // Insert new dummy questions
    await prisma_1.default.quizQuestion.createMany({
        data: dummyQuestions,
    });
    console.log(`Successfully generated ${dummyQuestions.length} dummy MCQs for Chapter 1: ${chapter.name}`);
}
generateDummyMCQs()
    .catch((e) => {
    console.error('Error generating MCQs:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=generate-dummy-mcq.js.map