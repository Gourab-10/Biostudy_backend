"use strict";
// src/routes/lecture.routes.ts
// ─── Free Lectures Routes ───
// GET    /api/lectures     → Get all free lectures
// POST   /api/lectures     → Add a lecture (admin)
// DELETE /api/lectures/:id → Delete a lecture (admin)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Get All Free Lectures (public)
// ═══════════════════════════════════════════
router.get('/', async (_req, res) => {
    try {
        const lectures = await prisma_1.default.freeLecture.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json({ lectures });
    }
    catch (error) {
        console.error('[Lectures] Get lectures error:', error);
        res.status(500).json({ error: 'Failed to fetch lectures.' });
    }
});
// ═══════════════════════════════════════════
// Add Free Lecture (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { title, videoId } = req.body;
        if (!title || !videoId) {
            res.status(400).json({ error: 'title and videoId are required.' });
            return;
        }
        const lecture = await prisma_1.default.freeLecture.create({
            data: { title, videoId },
        });
        res.status(201).json({ lecture });
    }
    catch (error) {
        console.error('[Lectures] Add lecture error:', error);
        res.status(500).json({ error: 'Failed to add lecture.' });
    }
});
// ═══════════════════════════════════════════
// Delete Free Lecture (Admin)
// ═══════════════════════════════════════════
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        await prisma_1.default.freeLecture.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Lecture deleted.' });
    }
    catch (error) {
        console.error('[Lectures] Delete lecture error:', error);
        res.status(500).json({ error: 'Failed to delete lecture.' });
    }
});
exports.default = router;
//# sourceMappingURL=lecture.routes.js.map