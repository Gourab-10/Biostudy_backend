"use strict";
// src/routes/admin.routes.ts
// ─── Admin Dashboard & User Management Routes ───
// GET  /api/admin/stats         → Get app statistics
// GET  /api/admin/users         → Get all users
// PUT  /api/admin/users/:id/role → Update user role
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All admin routes require authentication + admin role
router.use(auth_middleware_1.authenticate, auth_middleware_1.requireAdmin);
// ═══════════════════════════════════════════
// Get App Statistics
// ═══════════════════════════════════════════
router.get('/stats', async (_req, res) => {
    try {
        // Total users
        const totalUsers = await prisma_1.default.user.count();
        // Total admins
        const totalAdmins = await prisma_1.default.user.count({
            where: { role: 'admin' },
        });
        // Total quizzes taken (sum of all users' totalQuizzes)
        const quizAgg = await prisma_1.default.user.aggregate({
            _sum: { totalQuizzes: true },
        });
        const totalQuizzesTaken = quizAgg._sum.totalQuizzes || 0;
        // Global average score (average of all users who have taken quizzes)
        const scoreAgg = await prisma_1.default.user.aggregate({
            _avg: { averageScore: true },
            where: { averageScore: { gt: 0 } },
        });
        const avgScoreGlobal = Math.round(scoreAgg._avg.averageScore || 0);
        res.json({
            totalUsers,
            totalAdmins,
            totalQuizzesTaken,
            avgScoreGlobal,
        });
    }
    catch (error) {
        console.error('[Admin] Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch app statistics.' });
    }
});
// ═══════════════════════════════════════════
// Get All Users
// ═══════════════════════════════════════════
router.get('/users', async (req, res) => {
    try {
        const search = req.query.search;
        const where = {};
        if (search) {
            where.OR = [
                { displayName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        const users = await prisma_1.default.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                selectedClass: true,
                streak: true,
                totalQuizzes: true,
                averageScore: true,
                createdAt: true,
            },
        });
        res.json({ users });
    }
    catch (error) {
        console.error('[Admin] Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});
// ═══════════════════════════════════════════
// Update User Role
// ═══════════════════════════════════════════
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!role || !['admin', 'student'].includes(role)) {
            res.status(400).json({ error: 'role must be "admin" or "student".' });
            return;
        }
        const user = await prisma_1.default.user.update({
            where: { id: req.params.id },
            data: { role },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
            },
        });
        res.json({ user });
    }
    catch (error) {
        console.error('[Admin] Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map