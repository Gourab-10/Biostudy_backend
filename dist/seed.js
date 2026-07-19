"use strict";
// src/seed.ts
// ─── Database Seed Script ───
// Creates the initial admin user, sample data, a dummy PDF, and a test access code.
// Run with: npm run db:seed
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ─── Dummy PDF Generator ───
// Creates a minimal valid PDF without external libraries
function escapePdfString(str) {
    return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function generateDummyPdf(title, bodyLines) {
    const titleContent = `BT /F1 18 Tf 50 750 Td (${escapePdfString(title)}) Tj ET`;
    const textContent = bodyLines
        .map((line, i) => `BT /F1 11 Tf 50 ${710 - i * 18} Td (${escapePdfString(line)}) Tj ET`)
        .join('\n');
    const stream = `${titleContent}\n${textContent}`;
    const streamLength = Buffer.byteLength(stream, 'ascii');
    const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamLength}>>
stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
    return Buffer.from(pdf, 'ascii');
}
async function main() {
    console.log('🌱 Seeding database...');
    // ─── Create Admin User ───
    const adminPassword = await bcrypt_1.default.hash('admin123', 12);
    const admin = await prisma_1.default.user.upsert({
        where: { email: 'admin@biostudy.app' },
        update: {},
        create: {
            email: 'admin@biostudy.app',
            passwordHash: adminPassword,
            displayName: 'BioStudy Admin',
            role: 'admin',
            selectedClass: 11,
        },
    });
    console.log(`✅ Admin user created: ${admin.email}`);
    // ─── Create Sample Student ───
    const studentPassword = await bcrypt_1.default.hash('student123', 12);
    const student = await prisma_1.default.user.upsert({
        where: { email: 'student@biostudy.app' },
        update: {},
        create: {
            email: 'student@biostudy.app',
            passwordHash: studentPassword,
            displayName: 'Test Student',
            role: 'student',
            selectedClass: 11,
        },
    });
    console.log(`✅ Student user created: ${student.email}`);
    // ─── Generate Dummy PDF ───
    const uploadsDir = path_1.default.resolve(__dirname, '../uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    const pdfFilename = 'biostudy-ch1-the-living-world-notes.pdf';
    const pdfPath = path_1.default.join(uploadsDir, pdfFilename);
    const pdfBuffer = generateDummyPdf('Chapter 1: The Living World - Study Notes', [
        'NCERT Biology Class 11 - Chapter 1',
        '',
        '1. What is Living?',
        '   - Growth, reproduction, metabolism, cellular organization',
        '   - Response to stimuli, self-replication, self-organization',
        '',
        '2. Biodiversity',
        '   - The number and types of organisms on earth',
        '   - Nomenclature: Binomial nomenclature by Linnaeus',
        '   - ICBN for plants, ICZN for animals',
        '',
        '3. Taxonomic Categories (Hierarchy)',
        '   - Species > Genus > Family > Order > Class > Phylum > Kingdom',
        '   - Species is the basic unit of classification',
        '',
        '4. Taxonomic Aids',
        '   - Herbarium, Botanical Gardens, Museum',
        '   - Zoological Parks, Keys, Flora, Monographs',
        '',
        '5. Key Points',
        '   - Carolus Linnaeus: Father of Taxonomy',
        '   - Binomial nomenclature: Generic name + Specific epithet',
        '   - Example: Homo sapiens, Mangifera indica',
        '',
        '--- This is a dummy test PDF for BioStudy ---',
    ]);
    fs_1.default.writeFileSync(pdfPath, pdfBuffer);
    console.log(`✅ Dummy PDF created: ${pdfFilename} (${pdfBuffer.length} bytes)`);
    const pdfUrl = `/uploads/${pdfFilename}`;
    // ─── Create Sample Chapters ───
    // Chapter 1 gets the dummy PDF attached
    const chapter1 = await prisma_1.default.chapter.create({
        data: {
            classNum: 11,
            number: '1',
            name: 'The Living World',
            topics: 8,
            semester: 1,
            pdfUrls: JSON.stringify([pdfUrl]),
        },
    });
    const chapter2 = await prisma_1.default.chapter.create({
        data: {
            classNum: 11,
            number: '2',
            name: 'Biological Classification',
            topics: 10,
            semester: 1,
            pdfUrls: JSON.stringify([]),
        },
    });
    const chapter3 = await prisma_1.default.chapter.create({
        data: {
            classNum: 11,
            number: '3',
            name: 'Plant Kingdom',
            topics: 12,
            semester: 1,
            pdfUrls: JSON.stringify([]),
        },
    });
    console.log(`✅ Sample chapters created: ${chapter1.name}, ${chapter2.name}, ${chapter3.name}`);
    console.log(`   📄 PDF attached to: ${chapter1.name}`);
    // ─── Create Sample Quiz Questions ───
    await prisma_1.default.quizQuestion.createMany({
        data: [
            {
                chapterId: chapter1.id,
                classNum: 11,
                text: 'What is the basic unit of classification?',
                options: JSON.stringify(['Species', 'Genus', 'Family', 'Order']),
                correctIndex: 0,
                explanation: 'Species is the basic unit of classification in taxonomy. A species is a group of organisms that can interbreed and produce fertile offspring.',
            },
            {
                chapterId: chapter1.id,
                classNum: 11,
                text: 'Who is known as the father of taxonomy?',
                options: JSON.stringify(['Darwin', 'Linnaeus', 'Mendel', 'Lamarck']),
                correctIndex: 1,
                explanation: 'Carolus Linnaeus is known as the father of taxonomy. He introduced the binomial nomenclature system for naming organisms.',
            },
            {
                chapterId: chapter2.id,
                classNum: 11,
                text: 'Which kingdom includes all prokaryotic organisms?',
                options: JSON.stringify(['Plantae', 'Animalia', 'Monera', 'Protista']),
                correctIndex: 2,
                explanation: 'Monera includes all prokaryotic organisms like bacteria and cyanobacteria. They lack a membrane-bound nucleus.',
            },
        ],
    });
    console.log('✅ Sample quiz questions created.');
    // ─── Create Sample Free Lectures ───
    await prisma_1.default.freeLecture.createMany({
        data: [
            { title: 'Introduction to Biology', videoId: 'dQw4w9WgXcQ' },
            { title: 'Cell Structure Explained', videoId: 'URUJD5NEXC8' },
        ],
    });
    console.log('✅ Sample free lectures created.');
    // ─── Create Test Notes Access Code ───
    const notesCode = await prisma_1.default.accessCode.create({
        data: {
            code: 'NOTES-TEST',
            classNum: 11,
            chapterId: null, // Unlocks ALL class 11 chapters
            maxUses: -1, // Unlimited uses
            isActive: true,
            expiresAt: null, // Never expires
        },
    });
    console.log(`✅ Notes access code created: ${notesCode.code}`);
    console.log('\n🎉 Seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin login:    admin@biostudy.app / admin123');
    console.log('Student login:  student@biostudy.app / student123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📝 Notes Access Code:  NOTES-TEST');
    console.log('   Use POST /api/notes/verify-code with { "code": "NOTES-TEST" }');
    console.log('   to get download links for PDF notes.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=seed.js.map