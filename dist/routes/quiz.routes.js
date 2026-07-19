"use strict";
// src/routes/quiz.routes.ts
// ─── Quiz Routes ───
// GET  /api/quizzes                     → Get questions (filter by classNum, chapterId)
// POST /api/quizzes                     → Add quiz question (admin)
// PUT  /api/quizzes/:id                 → Update quiz question (admin)
// DELETE /api/quizzes/:id               → Delete quiz question (admin)
// POST /api/quizzes/submit              → Submit quiz result (student)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Get Quiz Questions (authenticated)
// ═══════════════════════════════════════════
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const classNum = req.query.classNum ? parseInt(req.query.classNum) : undefined;
        const chapterId = req.query.chapterId;
        const where = {};
        if (classNum !== undefined)
            where.classNum = classNum;
        if (chapterId)
            where.chapterId = chapterId;
        const questions = await prisma_1.default.quizQuestion.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        res.json({ questions });
    }
    catch (error) {
        console.error('[Quiz] Get questions error:', error);
        res.status(500).json({ error: 'Failed to fetch questions.' });
    }
});
// ═══════════════════════════════════════════
// Add Quiz Question (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { chapterId, classNum, text, options, correctIndex, explanation } = req.body;
        if (!chapterId || !text || !options || correctIndex === undefined || !explanation) {
            res.status(400).json({ error: 'chapterId, classNum, text, options, correctIndex, and explanation are required.' });
            return;
        }
        if (!Array.isArray(options) || options.length !== 4) {
            res.status(400).json({ error: 'options must be an array of exactly 4 strings.' });
            return;
        }
        const question = await prisma_1.default.quizQuestion.create({
            data: {
                chapterId,
                classNum: classNum || 11,
                text,
                options: JSON.stringify(options),
                correctIndex,
                explanation,
            },
        });
        res.status(201).json({ question });
    }
    catch (error) {
        console.error('[Quiz] Add question error:', error);
        res.status(500).json({ error: 'Failed to add question.' });
    }
});
// ═══════════════════════════════════════════
// Update Quiz Question (Admin)
// ═══════════════════════════════════════════
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { text, options, correctIndex, explanation, chapterId, classNum } = req.body;
        const updateData = {};
        if (text !== undefined)
            updateData.text = text;
        if (options !== undefined)
            updateData.options = JSON.stringify(options);
        if (correctIndex !== undefined)
            updateData.correctIndex = correctIndex;
        if (explanation !== undefined)
            updateData.explanation = explanation;
        if (chapterId !== undefined)
            updateData.chapterId = chapterId;
        if (classNum !== undefined)
            updateData.classNum = classNum;
        const question = await prisma_1.default.quizQuestion.update({
            where: { id: req.params.id },
            data: updateData,
        });
        res.json({ question });
    }
    catch (error) {
        console.error('[Quiz] Update question error:', error);
        res.status(500).json({ error: 'Failed to update question.' });
    }
});
// ═══════════════════════════════════════════
// Delete Quiz Question (Admin)
// ═══════════════════════════════════════════
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        await prisma_1.default.quizQuestion.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Question deleted.' });
    }
    catch (error) {
        console.error('[Quiz] Delete question error:', error);
        res.status(500).json({ error: 'Failed to delete question.' });
    }
});
// ═══════════════════════════════════════════
// Submit Quiz Result (Student)
// ═══════════════════════════════════════════
router.post('/submit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { chapterId, chapterName, score, totalQuestions, accuracy } = req.body;
        if (!chapterId || !chapterName || score === undefined || !totalQuestions || accuracy === undefined) {
            res.status(400).json({ error: 'chapterId, chapterName, score, totalQuestions, and accuracy are required.' });
            return;
        }
        // 1. Save the quiz score
        const quizScore = await prisma_1.default.quizScore.create({
            data: {
                userId: req.userId,
                chapterId,
                chapterName,
                score,
                totalQuestions,
                accuracy,
            },
        });
        // 2. Update aggregate stats on the user profile
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.userId },
            select: { totalQuizzes: true, averageScore: true },
        });
        if (user) {
            const prevTotal = user.totalQuizzes;
            const prevAvg = user.averageScore;
            const newTotal = prevTotal + 1;
            const newAvg = Math.round((prevAvg * prevTotal + accuracy) / newTotal);
            await prisma_1.default.user.update({
                where: { id: req.userId },
                data: {
                    totalQuizzes: newTotal,
                    averageScore: newAvg,
                },
            });
        }
        res.status(201).json({ quizScore });
    }
    catch (error) {
        console.error('[Quiz] Submit result error:', error);
        res.status(500).json({ error: 'Failed to submit quiz result.' });
    }
});
exports.default = router;
//# sourceMappingURL=quiz.routes.js.map