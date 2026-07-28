"use strict";
// src/routes/quiz.routes.ts
// ─── Dynamic Quiz Routes ───
// Student Endpoints:
// GET  /api/quizzes/active              → Get active dynamic quizzes (classNum filter, time period filter)
// GET  /api/quizzes/detail/:id          → Get full details & questions for a quiz
// GET  /api/quizzes/my-attempts         → Get current user's quiz attempt history
// POST /api/quizzes/submit              → Submit quiz result
// GET  /api/quizzes                     → Legacy get questions (chapterId/classNum filter)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Admin Endpoints:
// GET    /api/quizzes/admin/all         → Get all quizzes for admin panel
// POST   /api/quizzes/admin/create      → Create new dynamic quiz with timer & schedule
// PUT    /api/quizzes/admin/:id         → Update quiz settings (timer, schedule, active status)
// DELETE /api/quizzes/admin/:id         → Delete quiz
// POST   /api/quizzes/admin/:id/questions → Add question to a quiz
// DELETE /api/quizzes/admin/questions/:qId → Delete quiz question
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const cleanup_1 = require("../lib/cleanup");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// STUDENT: Get Active Quizzes
// ═══════════════════════════════════════════
router.get('/active', auth_middleware_1.authenticate, async (req, res) => {
    try {
        await (0, cleanup_1.cleanupExpiredQuizzes)();
        const classNumParam = req.query.classNum ? parseInt(req.query.classNum) : undefined;
        const now = new Date();
        // Fetch active quizzes where startsAt <= now and (expiresAt is null or expiresAt >= now)
        const quizzes = await prisma_1.default.quiz.findMany({
            where: {
                isActive: true,
                startsAt: { lte: now },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: now } },
                ],
                ...(classNumParam !== undefined && classNumParam !== 0
                    ? { OR: [{ classNum: classNumParam }, { classNum: 0 }] }
                    : {}),
            },
            include: {
                chapter: { select: { id: true, name: true, number: true } },
                _count: { select: { questions: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ quizzes });
    }
    catch (error) {
        console.error('[Quiz] Get active quizzes error:', error);
        res.status(500).json({ error: 'Failed to fetch active quizzes.' });
    }
});
// ═══════════════════════════════════════════
// STUDENT: Get Quiz Details & Questions
// ═══════════════════════════════════════════
router.get('/detail/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const quiz = await prisma_1.default.quiz.findUnique({
            where: { id: req.params.id },
            include: {
                chapter: { select: { id: true, name: true, number: true } },
                questions: true,
            },
        });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found.' });
            return;
        }
        const formattedQuestions = quiz.questions.map((q) => {
            let parsedOpts = [];
            try {
                parsedOpts = JSON.parse(q.options);
            }
            catch (e) {
                parsedOpts = [q.options];
            }
            return {
                ...q,
                options: parsedOpts,
            };
        });
        res.json({
            quiz: {
                ...quiz,
                questions: formattedQuestions,
            },
        });
    }
    catch (error) {
        console.error('[Quiz] Get quiz detail error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz detail.' });
    }
});
// ═══════════════════════════════════════════
// STUDENT: Get Attempt History
// ═══════════════════════════════════════════
router.get('/my-attempts', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const attempts = await prisma_1.default.quizScore.findMany({
            where: { userId: req.userId },
            include: {
                quiz: { select: { id: true, title: true, durationMinutes: true } },
                chapter: { select: { id: true, name: true } },
            },
            orderBy: { completedAt: 'desc' },
        });
        res.json({ attempts });
    }
    catch (error) {
        console.error('[Quiz] Get attempts error:', error);
        res.status(500).json({ error: 'Failed to fetch attempt history.' });
    }
});
// ═══════════════════════════════════════════
// STUDENT: Submit Quiz Result (one attempt only)
// ═══════════════════════════════════════════
router.post('/submit', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { quizId, chapterId, chapterName, score, totalQuestions, accuracy, timeTakenSec } = req.body;
        if (score === undefined || totalQuestions === undefined || accuracy === undefined) {
            res.status(400).json({ error: 'score, totalQuestions, and accuracy are required.' });
            return;
        }
        // ─── Prevent duplicate attempts ───
        // Check if the user already submitted for this specific quiz or chapter
        const existingAttempt = await prisma_1.default.quizScore.findFirst({
            where: {
                userId: req.userId,
                ...(quizId ? { quizId } : {}),
                ...(chapterId ? { chapterId } : {}),
                // For free-test (no quizId, chapterId='free-test'), match by chapterName
                ...(!quizId && !chapterId && chapterName ? { chapterName } : {}),
            },
        });
        if (existingAttempt) {
            res.status(409).json({
                error: 'You have already attempted this quiz. Only one attempt is allowed.',
                existingScore: existingAttempt,
            });
            return;
        }
        let resolvedChapterName = chapterName || 'General Quiz';
        if (quizId && !chapterName) {
            const quiz = await prisma_1.default.quiz.findUnique({ where: { id: quizId } });
            if (quiz)
                resolvedChapterName = quiz.title;
        }
        // 1. Save the quiz score record
        const quizScore = await prisma_1.default.quizScore.create({
            data: {
                userId: req.userId,
                quizId: quizId || null,
                chapterId: chapterId || null,
                chapterName: resolvedChapterName,
                score: Number(score),
                totalQuestions: Number(totalQuestions),
                accuracy: Number(accuracy),
                timeTakenSec: timeTakenSec ? Number(timeTakenSec) : null,
            },
        });
        // 2. Update aggregate user profile stats
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.userId },
            select: { totalQuizzes: true, averageScore: true },
        });
        if (user) {
            const prevTotal = user.totalQuizzes;
            const prevAvg = user.averageScore;
            const newTotal = prevTotal + 1;
            const newAvg = Math.round((prevAvg * prevTotal + Number(accuracy)) / newTotal);
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
// ═══════════════════════════════════════════
// STUDENT: Get My Quiz Scores (completed quizzes)
// ═══════════════════════════════════════════
router.get('/my-scores', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const scores = await prisma_1.default.quizScore.findMany({
            where: { userId: req.userId },
            orderBy: { completedAt: 'desc' },
        });
        res.json({ scores });
    }
    catch (error) {
        console.error('[Quiz] Get my scores error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz scores.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Fetch All Quizzes
// ═══════════════════════════════════════════
router.get('/admin/all', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const quizzes = await prisma_1.default.quiz.findMany({
            include: {
                chapter: { select: { id: true, name: true, number: true } },
                questions: true,
                _count: { select: { scores: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const formattedQuizzes = quizzes.map((quiz) => ({
            ...quiz,
            questions: quiz.questions.map((q) => {
                let opts = [];
                try {
                    opts = JSON.parse(q.options);
                }
                catch (e) {
                    opts = [q.options];
                }
                return { ...q, options: opts };
            }),
        }));
        res.json({ quizzes: formattedQuizzes });
    }
    catch (error) {
        console.error('[Quiz Admin] Get all quizzes error:', error);
        res.status(500).json({ error: 'Failed to fetch quizzes.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Create Dynamic Quiz
// ═══════════════════════════════════════════
router.post('/admin/create', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { title, description, classNum, chapterId, durationMinutes, startsAt, expiresAt, isActive, secretKey } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Quiz title is required.' });
            return;
        }
        const quiz = await prisma_1.default.quiz.create({
            data: {
                title,
                description: description || null,
                classNum: classNum !== undefined ? Number(classNum) : 11,
                chapterId: chapterId || null,
                durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : 15,
                startsAt: startsAt ? new Date(startsAt) : new Date(),
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                secretKey: secretKey || null,
            },
        });
        res.status(201).json({ quiz });
    }
    catch (error) {
        console.error('[Quiz Admin] Create quiz error:', error);
        res.status(500).json({ error: 'Failed to create quiz.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Update Dynamic Quiz
// ═══════════════════════════════════════════
router.put('/admin/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { title, description, classNum, chapterId, durationMinutes, startsAt, expiresAt, isActive, secretKey } = req.body;
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (description !== undefined)
            updateData.description = description;
        if (classNum !== undefined)
            updateData.classNum = Number(classNum);
        if (chapterId !== undefined)
            updateData.chapterId = chapterId || null;
        if (durationMinutes !== undefined)
            updateData.durationMinutes = Number(durationMinutes);
        if (startsAt !== undefined)
            updateData.startsAt = startsAt ? new Date(startsAt) : new Date();
        if (expiresAt !== undefined)
            updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
        if (isActive !== undefined)
            updateData.isActive = Boolean(isActive);
        if (secretKey !== undefined)
            updateData.secretKey = secretKey || null;
        const quiz = await prisma_1.default.quiz.update({
            where: { id: req.params.id },
            data: updateData,
        });
        res.json({ quiz });
    }
    catch (error) {
        console.error('[Quiz Admin] Update quiz error:', error);
        res.status(500).json({ error: 'Failed to update quiz.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Delete Quiz
// ═══════════════════════════════════════════
router.delete('/admin/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    const id = req.params.id;
    if (id.startsWith('mock-')) {
        res.json({ message: 'Mock quiz deleted.' });
        return;
    }
    try {
        await prisma_1.default.quiz.delete({
            where: { id },
        });
        res.json({ message: 'Quiz deleted successfully.' });
    }
    catch (error) {
        if (error.code === 'P2025') {
            res.json({ message: 'Quiz already deleted.' });
            return;
        }
        console.error('[Quiz Admin] Delete quiz error:', error);
        res.status(500).json({ error: 'Failed to delete quiz.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Add Question to Quiz
// ═══════════════════════════════════════════
router.post('/admin/:id/questions', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const quizId = req.params.id;
        const { text, options, correctIndex, explanation } = req.body;
        if (!text || !options || correctIndex === undefined || explanation === undefined) {
            res.status(400).json({ error: 'text, options, correctIndex, and explanation are required.' });
            return;
        }
        if (!Array.isArray(options) || options.length !== 4) {
            res.status(400).json({ error: 'options must be an array of 4 strings.' });
            return;
        }
        const quiz = await prisma_1.default.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found.' });
            return;
        }
        const question = await prisma_1.default.quizQuestion.create({
            data: {
                quizId: quiz.id,
                chapterId: quiz.chapterId,
                classNum: quiz.classNum,
                text,
                options: JSON.stringify(options),
                correctIndex: Number(correctIndex),
                explanation,
            },
        });
        res.status(201).json({ question: { ...question, options } });
    }
    catch (error) {
        console.error('[Quiz Admin] Add question error:', error);
        res.status(500).json({ error: 'Failed to add question.' });
    }
});
// ═══════════════════════════════════════════
// ADMIN: Delete Question
// ═══════════════════════════════════════════
router.delete('/admin/questions/:qId', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    const qId = req.params.qId;
    if (qId.startsWith('mock-')) {
        res.json({ message: 'Mock question deleted.' });
        return;
    }
    try {
        await prisma_1.default.quizQuestion.delete({
            where: { id: qId },
        });
        res.json({ message: 'Question deleted successfully.' });
    }
    catch (error) {
        if (error.code === 'P2025') {
            res.json({ message: 'Question already deleted.' });
            return;
        }
        console.error('[Quiz Admin] Delete question error:', error);
        res.status(500).json({ error: 'Failed to delete question.' });
    }
});
// ═══════════════════════════════════════════
// LEGACY: Get Questions (Filter by classNum/chapterId)
// ═══════════════════════════════════════════
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        await (0, cleanup_1.cleanupExpiredQuizzes)();
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
// LEGACY: Add Question (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { chapterId, classNum, text, options, correctIndex, explanation } = req.body;
        if (!text || !options || correctIndex === undefined || explanation === undefined) {
            res.status(400).json({ error: 'text, options, correctIndex, and explanation are required.' });
            return;
        }
        if (!Array.isArray(options) || options.length !== 4) {
            res.status(400).json({ error: 'options must be an array of 4 strings.' });
            return;
        }
        // Resolve chapterId: only link if it exists in the database and is a valid UUID
        let resolvedChapterId = null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (chapterId && uuidRegex.test(chapterId)) {
            const chapter = await prisma_1.default.chapter.findUnique({ where: { id: chapterId } });
            if (chapter) {
                resolvedChapterId = chapter.id;
            }
        }
        const question = await prisma_1.default.quizQuestion.create({
            data: {
                chapterId: resolvedChapterId,
                classNum: classNum ? parseInt(classNum) : 11,
                text,
                options: JSON.stringify(options),
                correctIndex,
                explanation,
            },
        });
        res.status(201).json({ question });
    }
    catch (error) {
        console.error('[Quiz] Add legacy question error:', error);
        res.status(500).json({ error: 'Failed to add question.' });
    }
});
// ═══════════════════════════════════════════
// LEGACY: Update Question (Admin)
// ═══════════════════════════════════════════
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { text, options, correctIndex, explanation } = req.body;
        const updateData = {};
        if (text !== undefined)
            updateData.text = text;
        if (options !== undefined)
            updateData.options = JSON.stringify(options);
        if (correctIndex !== undefined)
            updateData.correctIndex = correctIndex;
        if (explanation !== undefined)
            updateData.explanation = explanation;
        const question = await prisma_1.default.quizQuestion.update({
            where: { id: req.params.id },
            data: updateData,
        });
        res.json({ question });
    }
    catch (error) {
        console.error('[Quiz] Update legacy question error:', error);
        res.status(500).json({ error: 'Failed to update question.' });
    }
});
// ═══════════════════════════════════════════
// LEGACY: Delete Question (Admin)
// ═══════════════════════════════════════════
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    const id = req.params.id;
    if (id.startsWith('mock-')) {
        res.json({ message: 'Mock question deleted.' });
        return;
    }
    try {
        await prisma_1.default.quizQuestion.delete({
            where: { id: id },
        });
        res.json({ message: 'Question deleted.' });
    }
    catch (error) {
        if (error.code === 'P2025') {
            res.json({ message: 'Question already deleted.' });
            return;
        }
        console.error('[Quiz] Delete legacy question error:', error);
        res.status(500).json({ error: 'Failed to delete question.' });
    }
});
exports.default = router;
//# sourceMappingURL=quiz.routes.js.map