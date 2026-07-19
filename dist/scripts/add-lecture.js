"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const prisma_1 = __importDefault(require("../lib/prisma"));
async function addLecture() {
    const title = "The Living World | Biology Class 11";
    const videoId = "6XI6dFWjLm8";
    console.log(`Adding lecture: ${title} (Video ID: ${videoId})...`);
    // Check if it already exists
    const existing = await prisma_1.default.freeLecture.findFirst({
        where: { videoId }
    });
    if (existing) {
        console.log('Lecture already exists in the database.');
        return;
    }
    await prisma_1.default.freeLecture.create({
        data: {
            title,
            videoId,
        }
    });
    console.log('Lecture added successfully!');
}
addLecture()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
//# sourceMappingURL=add-lecture.js.map