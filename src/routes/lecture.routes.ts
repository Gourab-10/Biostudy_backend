// src/routes/lecture.routes.ts
// ─── Free Lectures Routes ───
// GET    /api/lectures     → Get all free lectures
// POST   /api/lectures     → Add a lecture (admin)
// DELETE /api/lectures/:id → Delete a lecture (admin)

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════
// Get All Free Lectures (public)
// ═══════════════════════════════════════════

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const lectures = await prisma.freeLecture.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ lectures });
  } catch (error: any) {
    console.error('[Lectures] Get lectures error:', error);
    res.status(500).json({ error: 'Failed to fetch lectures.' });
  }
});

// ═══════════════════════════════════════════
// Add Free Lecture (Admin)
// ═══════════════════════════════════════════

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, videoId } = req.body;

    if (!title || !videoId) {
      res.status(400).json({ error: 'title and videoId are required.' });
      return;
    }

    const lecture = await prisma.freeLecture.create({
      data: { title, videoId },
    });

    res.status(201).json({ lecture });
  } catch (error: any) {
    console.error('[Lectures] Add lecture error:', error);
    res.status(500).json({ error: 'Failed to add lecture.' });
  }
});

// ═══════════════════════════════════════════
// Delete Free Lecture (Admin)
// ═══════════════════════════════════════════

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.freeLecture.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Lecture deleted.' });
  } catch (error: any) {
    console.error('[Lectures] Delete lecture error:', error);
    res.status(500).json({ error: 'Failed to delete lecture.' });
  }
});

export default router;
