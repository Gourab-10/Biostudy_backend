"use strict";
// src/scripts/generate-dummy-pdf.ts
// ─── Generate a dummy PDF for testing ───
// Creates a minimal valid PDF in the uploads/ directory.
// Run with: npx ts-node-dev src/scripts/generate-dummy-pdf.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Generates a minimal but valid PDF file with the given text content.
 * This creates a proper PDF 1.4 document without any external libraries.
 */
function generatePdf(title, bodyLines) {
    // Build the body content as a single text block
    const textContent = bodyLines
        .map((line, i) => `BT /F1 12 Tf 50 ${700 - i * 20} Td (${escapePdfString(line)}) Tj ET`)
        .join('\n');
    const titleContent = `BT /F1 18 Tf 50 750 Td (${escapePdfString(title)}) Tj ET`;
    const stream = `${titleContent}\n${textContent}`;
    const streamLength = Buffer.byteLength(stream, 'ascii');
    const pdf = `%PDF-1.4

1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(317 + streamLength).toString().padStart(3, '0')} 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;
    return Buffer.from(pdf, 'ascii');
}
function escapePdfString(str) {
    return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
// ─── Main ───
const uploadsDir = path_1.default.resolve(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const pdfContent = generatePdf('BioStudy - Chapter 1: The Living World', [
    '1. What is Living?',
    '   - Growth, Reproduction, Ability to sense environment.',
    '   - Metabolism: sum total of all chemical reactions occurring in our body.',
    '',
    '2. Diversity in the Living World',
    '   - Biodiversity: Number and types of organisms present on earth.',
    '   - Nomenclature: Standardize the naming of living organisms.',
    '   - ICBN: International Code for Botanical Nomenclature.',
    '   - ICZN: International Code of Zoological Nomenclature.',
    '',
    '3. Taxonomic Categories',
    '   - Species -> Genus -> Family -> Order -> Class -> Phylum -> Kingdom.',
    '',
    '4. Taxonomical Aids',
    '   - Herbarium, Botanical Gardens, Museum, Zoological Parks, Key.',
    '',
    '---',
    'Important Concepts:',
    '   - Binomial nomenclature: Generic name + Specific epithet',
    '   - Example: Homo sapiens, Mangifera indica',
    '',
    '--- This is a dummy test PDF for BioStudy ---',
]);
const filename = 'biostudy-ch1-the-living-world-notes.pdf';
const filePath = path_1.default.join(uploadsDir, filename);
fs_1.default.writeFileSync(filePath, pdfContent);
console.log(`✅ Dummy PDF created: ${filePath}`);
console.log(`   Filename: ${filename}`);
console.log(`   Size: ${pdfContent.length} bytes`);
console.log(`   URL path: /uploads/${filename}`);
//# sourceMappingURL=generate-dummy-pdf.js.map