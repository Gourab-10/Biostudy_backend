// src/routes/admin.routes.ts
// ─── Admin Dashboard & User Management Routes ───
// GET  /api/admin/stats         → Get app statistics
// GET  /api/admin/users         → Get all users
// PUT  /api/admin/users/:id/role → Update user role

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ═══════════════════════════════════════════
// Get App Statistics
// ═══════════════════════════════════════════

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Total users
    const totalUsers = await prisma.user.count();

    // Total admins
    const totalAdmins = await prisma.user.count({
      where: { role: 'admin' },
    });

    // Total quizzes taken (sum of all users' totalQuizzes)
    const quizAgg = await prisma.user.aggregate({
      _sum: { totalQuizzes: true },
    });
    const totalQuizzesTaken = quizAgg._sum.totalQuizzes || 0;

    // Global average score (average of all users who have taken quizzes)
    const scoreAgg = await prisma.user.aggregate({
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
  } catch (error: any) {
    console.error('[Admin] Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch app statistics.' });
  }
});

// ═══════════════════════════════════════════
// Get All Users
// ═══════════════════════════════════════════

router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
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
  } catch (error: any) {
    console.error('[Admin] Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ═══════════════════════════════════════════
// Update User Role
// ═══════════════════════════════════════════

router.put('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.body;

    if (!role || !['admin', 'student'].includes(role)) {
      res.status(400).json({ error: 'role must be "admin" or "student".' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { role },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    res.json({ user });
  } catch (error: any) {
    console.error('[Admin] Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
});

export default router;
