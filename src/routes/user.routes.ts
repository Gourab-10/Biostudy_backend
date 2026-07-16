// src/routes/user.routes.ts
// ─── User Profile Routes ───
// GET    /api/users/profile        → Get current user's profile
// PUT    /api/users/profile        → Update current user's profile
// PUT    /api/users/push-token     → Save push notification token
// GET    /api/users/quiz-scores    → Get quiz score history
// GET    /api/users/progress/:classNum → Get study progress for a class

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════
// Get Profile
// ═══════════════════════════════════════════

router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        selectedClass: true,
        avatarUrl: true,
        streak: true,
        totalQuizzes: true,
        averageScore: true,
        pushToken: true,
        platform: true,
        createdAt: true,
        redeemedCodes: {
          select: {
            accessCodeId: true,
          }
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const userProfile = {
      ...user,
      redeemedCodes: user.redeemedCodes.map(c => c.accessCodeId),
    };

    res.json({ user: userProfile });
  } catch (error: any) {
    console.error('[Users] Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// ═══════════════════════════════════════════
// Update Profile
// ═══════════════════════════════════════════

router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const { displayName, selectedClass, avatarUrl } = req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (selectedClass !== undefined) updateData.selectedClass = selectedClass;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        selectedClass: true,
        avatarUrl: true,
        streak: true,
        totalQuizzes: true,
        averageScore: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error: any) {
    console.error('[Users] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ═══════════════════════════════════════════
// Save Push Token
// ═══════════════════════════════════════════

router.put('/push-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pushToken, platform } = req.body;

    await prisma.user.update({
      where: { id: req.userId },
      data: { pushToken, platform },
    });

    res.json({ message: 'Push token saved.' });
  } catch (error: any) {
    console.error('[Users] Save push token error:', error);
    res.status(500).json({ error: 'Failed to save push token.' });
  }
});

// ═══════════════════════════════════════════
// Quiz Score History
// ═══════════════════════════════════════════

router.get('/quiz-scores', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const scores = await prisma.quizScore.findMany({
      where: { userId: req.userId },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    res.json({ scores });
  } catch (error: any) {
    console.error('[Users] Get quiz scores error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz scores.' });
  }
});

// ═══════════════════════════════════════════
// Study Progress
// ═══════════════════════════════════════════

router.get('/progress/:classNum', async (req: Request, res: Response): Promise<void> => {
  try {
    const classNum = parseInt(req.params.classNum as string);

    const progressRecords = await prisma.userProgress.findMany({
      where: {
        userId: req.userId,
        classNum,
      },
    });

    // Return as a map: { chapterId: progress }
    const progressMap: Record<string, number> = {};
    progressRecords.forEach((p) => {
      progressMap[p.chapterId] = p.progress;
    });

    res.json({ progress: progressMap });
  } catch (error: any) {
    console.error('[Users] Get progress error:', error);
    res.status(500).json({ error: 'Failed to fetch study progress.' });
  }
});

// ═══════════════════════════════════════════
// Update Chapter Progress
// ═══════════════════════════════════════════

router.put('/progress', async (req: Request, res: Response): Promise<void> => {
  try {
    const { classNum, chapterId, progress } = req.body;

    const clampedProgress = Math.min(1, Math.max(0, progress));

    await prisma.userProgress.upsert({
      where: {
        userId_chapterId: {
          userId: req.userId!,
          chapterId,
        },
      },
      update: {
        progress: clampedProgress,
      },
      create: {
        userId: req.userId!,
        chapterId,
        classNum,
        progress: clampedProgress,
      },
    });

    res.json({ message: 'Progress updated.' });
  } catch (error: any) {
    console.error('[Users] Update progress error:', error);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
});

export default router;
