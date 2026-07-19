"use strict";
// src/routes/chapter.routes.ts
// ─── Chapter Management Routes ───
// GET    /api/chapters              → Get all chapters (optionally filter by classNum)
// GET    /api/chapters/:id          → Get single chapter
// POST   /api/chapters              → Add a chapter (admin only)
// PUT    /api/chapters/:id          → Update a chapter (admin only)
// DELETE /api/chapters/:id          → Delete a chapter (admin only)
// PUT    /api/chapters/:id/add-pdf  → Add PDF URL to chapter
// PUT    /api/chapters/:id/remove-pdf → Remove PDF URL from chapter
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const mapChapter = (ch) => {
    let parsedPdfUrls = [];
    try {
        parsedPdfUrls = ch.pdfUrls ? JSON.parse(ch.pdfUrls) : [];
    }
    catch (e) { }
    return { ...ch, pdfUrls: parsedPdfUrls };
};
// ═══════════════════════════════════════════
// Get All Chapters (public or authenticated)
// ═══════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const classNum = req.query.classNum ? parseInt(req.query.classNum) : undefined;
        const where = classNum !== undefined ? { classNum } : {};
        const orderBy = classNum !== undefined
            ? { number: 'asc' }
            : { classNum: 'asc' };
        const chapters = await prisma_1.default.chapter.findMany({
            where,
            orderBy,
        });
        res.json({ chapters: chapters.map(mapChapter) });
    }
    catch (error) {
        console.error('[Chapters] Get chapters error:', error);
        res.status(500).json({ error: 'Failed to fetch chapters.' });
    }
});
// ═══════════════════════════════════════════
// Get Single Chapter
// ═══════════════════════════════════════════
router.get('/:id', async (req, res) => {
    try {
        const chapter = await prisma_1.default.chapter.findUnique({
            where: { id: req.params.id },
            include: {
                quizQuestions: true,
            },
        });
        if (!chapter) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        res.json({ chapter: mapChapter(chapter) });
    }
    catch (error) {
        console.error('[Chapters] Get chapter error:', error);
        res.status(500).json({ error: 'Failed to fetch chapter.' });
    }
});
// ═══════════════════════════════════════════
// Create Chapter (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { classNum, number, name, topics, semester, quizTimeLimit, validityHours } = req.body;
        if (!classNum || !number || !name) {
            res.status(400).json({ error: 'classNum, number, and name are required.' });
            return;
        }
        let quizExpiresAt = null;
        if (validityHours && Number(validityHours) > 0) {
            quizExpiresAt = new Date(Date.now() + Number(validityHours) * 60 * 60 * 1000);
        }
        const chapter = await prisma_1.default.chapter.create({
            data: {
                classNum,
                number: String(number),
                name,
                topics: topics || 0,
                semester: semester || 1,
                quizTimeLimit: quizTimeLimit || null,
                quizExpiresAt,
                pdfUrls: JSON.stringify([]),
            },
        });
        res.status(201).json({ chapter: mapChapter(chapter) });
    }
    catch (error) {
        console.error('[Chapters] Create chapter error:', error);
        res.status(500).json({ error: 'Failed to create chapter.' });
    }
});
// ═══════════════════════════════════════════
// Update Chapter (Admin)
// ═══════════════════════════════════════════
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { classNum, number, name, topics, semester, quizTimeLimit, validityHours } = req.body;
        const updateData = {};
        if (classNum !== undefined)
            updateData.classNum = classNum;
        if (number !== undefined)
            updateData.number = String(number);
        if (name !== undefined)
            updateData.name = name;
        if (topics !== undefined)
            updateData.topics = topics;
        if (semester !== undefined)
            updateData.semester = semester;
        if (quizTimeLimit !== undefined)
            updateData.quizTimeLimit = quizTimeLimit;
        if (validityHours !== undefined) {
            if (Number(validityHours) > 0) {
                updateData.quizExpiresAt = new Date(Date.now() + Number(validityHours) * 60 * 60 * 1000);
            }
            else {
                updateData.quizExpiresAt = null; // Clear expiration if 0 or empty
            }
        }
        const chapter = await prisma_1.default.chapter.update({
            where: { id: req.params.id },
            data: updateData,
        });
        res.json({ chapter: mapChapter(chapter) });
    }
    catch (error) {
        console.error('[Chapters] Update chapter error:', error);
        res.status(500).json({ error: 'Failed to update chapter.' });
    }
});
// ═══════════════════════════════════════════
// Delete Chapter (Admin)
// ═══════════════════════════════════════════
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        await prisma_1.default.chapter.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Chapter deleted.' });
    }
    catch (error) {
        console.error('[Chapters] Delete chapter error:', error);
        res.status(500).json({ error: 'Failed to delete chapter.' });
    }
});
// ═══════════════════════════════════════════
// Add PDF URL to Chapter (Admin)
// ═══════════════════════════════════════════
router.put('/:id/add-pdf', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) {
            res.status(400).json({ error: 'pdfUrl is required.' });
            return;
        }
        const chapter = await prisma_1.default.chapter.findUnique({ where: { id: req.params.id } });
        if (!chapter) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const currentPdfUrls = JSON.parse(chapter.pdfUrls || '[]');
        const updatedPdfUrls = [...currentPdfUrls, pdfUrl];
        const updated = await prisma_1.default.chapter.update({
            where: { id: req.params.id },
            data: { pdfUrls: JSON.stringify(updatedPdfUrls) },
        });
        res.json({ chapter: mapChapter(updated) });
    }
    catch (error) {
        console.error('[Chapters] Add PDF error:', error);
        res.status(500).json({ error: 'Failed to add PDF.' });
    }
});
// ═══════════════════════════════════════════
// Remove PDF URL from Chapter (Admin)
// ═══════════════════════════════════════════
router.put('/:id/remove-pdf', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { pdfUrl } = req.body;
        if (!pdfUrl) {
            res.status(400).json({ error: 'pdfUrl is required.' });
            return;
        }
        const chapter = await prisma_1.default.chapter.findUnique({ where: { id: req.params.id } });
        if (!chapter) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const currentPdfUrls = JSON.parse(chapter.pdfUrls || '[]');
        const updatedPdfUrls = currentPdfUrls.filter((url) => url !== pdfUrl);
        const updated = await prisma_1.default.chapter.update({
            where: { id: req.params.id },
            data: { pdfUrls: JSON.stringify(updatedPdfUrls) },
        });
        res.json({ chapter: mapChapter(updated) });
    }
    catch (error) {
        console.error('[Chapters] Remove PDF error:', error);
        res.status(500).json({ error: 'Failed to remove PDF.' });
    }
});
exports.default = router;
//# sourceMappingURL=chapter.routes.js.map