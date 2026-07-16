// src/routes/accessCode.routes.ts
// ─── Access Code Routes ───
// GET    /api/access-codes          → Get all access codes (admin)
// POST   /api/access-codes          → Generate access code (admin)
// PUT    /api/access-codes/:id/toggle → Toggle active status (admin)
// POST   /api/access-codes/redeem   → Redeem access code (student)

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════
// Get All Access Codes (Admin)
// ═══════════════════════════════════════════

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = user?.role === 'admin';

    let codes;
    if (isAdmin) {
      codes = await prisma.accessCode.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { redeemedBy: true } },
        },
      });
    } else {
      codes = await prisma.accessCode.findMany({
        where: {
          redeemedBy: { some: { userId: req.userId } }
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ codes });
  } catch (error: any) {
    console.error('[AccessCodes] Get codes error:', error);
    res.status(500).json({ error: 'Failed to fetch access codes.' });
  }
});

// ═══════════════════════════════════════════
// Generate Access Code (Admin)
// ═══════════════════════════════════════════

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, classNum, chapterId, maxUses, expiresAt } = req.body;

    if (!code || classNum === undefined) {
      res.status(400).json({ error: 'code and classNum are required.' });
      return;
    }

    // Check if code already exists
    const existing = await prisma.accessCode.findUnique({ where: { code } });
    if (existing) {
      res.status(409).json({ error: 'Access code already exists.' });
      return;
    }

    const accessCode = await prisma.accessCode.create({
      data: {
        code,
        classNum,
        chapterId: chapterId || null,
        maxUses: maxUses ?? -1,
        currentUses: 0,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ accessCode });
  } catch (error: any) {
    console.error('[AccessCodes] Generate code error:', error);
    res.status(500).json({ error: 'Failed to generate access code.' });
  }
});

// ═══════════════════════════════════════════
// Toggle Access Code Status (Admin)
// ═══════════════════════════════════════════

router.put('/:id/toggle', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body;

    const accessCode = await prisma.accessCode.update({
      where: { id: req.params.id as string },
      data: { isActive },
    });

    res.json({ accessCode });
  } catch (error: any) {
    console.error('[AccessCodes] Toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle access code status.' });
  }
});

// ═══════════════════════════════════════════
// Redeem Access Code (Student)
// ═══════════════════════════════════════════

router.post('/redeem', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'code is required.' });
      return;
    }

    // Find the access code
    const accessCode = await prisma.accessCode.findUnique({ where: { code } });

    if (!accessCode) {
      res.status(404).json({ error: 'Invalid access code.' });
      return;
    }

    if (!accessCode.isActive) {
      res.status(400).json({ error: 'This access code is no longer active.' });
      return;
    }

    // Check expiry
    if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
      res.status(400).json({ error: 'This access code has expired.' });
      return;
    }

    // Check max uses
    if (accessCode.maxUses !== -1 && accessCode.currentUses >= accessCode.maxUses) {
      res.status(400).json({ error: 'This access code has reached its maximum uses.' });
      return;
    }

    // Check if user already redeemed
    const existingRedemption = await prisma.userAccessCode.findUnique({
      where: {
        userId_accessCodeId: {
          userId: req.userId!,
          accessCodeId: accessCode.id,
        },
      },
    });

    if (existingRedemption) {
      res.status(400).json({ error: 'You have already redeemed this code.' });
      return;
    }

    // Create redemption record and increment uses (transaction)
    await prisma.$transaction([
      prisma.userAccessCode.create({
        data: {
          userId: req.userId!,
          accessCodeId: accessCode.id,
        },
      }),
      prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { currentUses: accessCode.currentUses + 1 },
      }),
    ]);

    res.json({ accessCode, message: 'Access code redeemed successfully.' });
  } catch (error: any) {
    console.error('[AccessCodes] Redeem code error:', error);
    res.status(500).json({ error: 'Failed to redeem access code.' });
  }
});

export default router;
