// src/routes/chapter.routes.ts
// ─── Chapter Management Routes ───
// GET    /api/chapters              → Get all chapters (optionally filter by classNum)
// GET    /api/chapters/:id          → Get single chapter
// POST   /api/chapters              → Add a chapter (admin only)
// PUT    /api/chapters/:id          → Update a chapter (admin only)
// DELETE /api/chapters/:id          → Delete a chapter (admin only)
// PUT    /api/chapters/:id/add-pdf  → Add PDF URL to chapter
// PUT    /api/chapters/:id/remove-pdf → Remove PDF URL from chapter

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

const mapChapter = (ch: any) => {
  let parsedPdfUrls = [];
  try {
    parsedPdfUrls = ch.pdfUrls ? JSON.parse(ch.pdfUrls) : [];
  } catch(e) {}
  return { ...ch, pdfUrls: parsedPdfUrls };
};

// ═══════════════════════════════════════════
// Get All Chapters (public or authenticated)
// ═══════════════════════════════════════════

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const classNum = req.query.classNum ? parseInt(req.query.classNum as string) : undefined;

    const where = classNum !== undefined ? { classNum } : {};
    const orderBy = classNum !== undefined
      ? { number: 'asc' as const }
      : { classNum: 'asc' as const };

    const chapters = await prisma.chapter.findMany({
      where,
      orderBy,
    });

    res.json({ chapters: chapters.map(mapChapter) });
  } catch (error: any) {
    console.error('[Chapters] Get chapters error:', error);
    res.status(500).json({ error: 'Failed to fetch chapters.' });
  }
});

// ═══════════════════════════════════════════
// Get Single Chapter
// ═══════════════════════════════════════════

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: req.params.id as string },
      include: {
        quizQuestions: true,
      },
    });

    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    res.json({ chapter: mapChapter(chapter) });
  } catch (error: any) {
    console.error('[Chapters] Get chapter error:', error);
    res.status(500).json({ error: 'Failed to fetch chapter.' });
  }
});

// ═══════════════════════════════════════════
// Create Chapter (Admin)
// ═══════════════════════════════════════════

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
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

    const chapter = await prisma.chapter.create({
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
  } catch (error: any) {
    console.error('[Chapters] Create chapter error:', error);
    res.status(500).json({ error: 'Failed to create chapter.' });
  }
});

// ═══════════════════════════════════════════
// Update Chapter (Admin)
// ═══════════════════════════════════════════

router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { classNum, number, name, topics, semester, quizTimeLimit, validityHours } = req.body;

    const updateData: any = {};
    if (classNum !== undefined) updateData.classNum = classNum;
    if (number !== undefined) updateData.number = String(number);
    if (name !== undefined) updateData.name = name;
    if (topics !== undefined) updateData.topics = topics;
    if (semester !== undefined) updateData.semester = semester;
    if (quizTimeLimit !== undefined) updateData.quizTimeLimit = quizTimeLimit;
    if (validityHours !== undefined) {
      if (Number(validityHours) > 0) {
        updateData.quizExpiresAt = new Date(Date.now() + Number(validityHours) * 60 * 60 * 1000);
      } else {
        updateData.quizExpiresAt = null; // Clear expiration if 0 or empty
      }
    }

    const chapter = await prisma.chapter.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json({ chapter: mapChapter(chapter) });
  } catch (error: any) {
    console.error('[Chapters] Update chapter error:', error);
    res.status(500).json({ error: 'Failed to update chapter.' });
  }
});

// ═══════════════════════════════════════════
// Delete Chapter (Admin)
// ═══════════════════════════════════════════

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.chapter.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Chapter deleted.' });
  } catch (error: any) {
    console.error('[Chapters] Delete chapter error:', error);
    res.status(500).json({ error: 'Failed to delete chapter.' });
  }
});

// ═══════════════════════════════════════════
// Add PDF URL to Chapter (Admin)
// ═══════════════════════════════════════════

router.put('/:id/add-pdf', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      res.status(400).json({ error: 'pdfUrl is required.' });
      return;
    }

    const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id as string } });
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const currentPdfUrls: string[] = JSON.parse(chapter.pdfUrls || '[]');
    const updatedPdfUrls = [...currentPdfUrls, pdfUrl];

    const updated = await prisma.chapter.update({
      where: { id: req.params.id as string },
      data: { pdfUrls: JSON.stringify(updatedPdfUrls) },
    });

    res.json({ chapter: mapChapter(updated) });
  } catch (error: any) {
    console.error('[Chapters] Add PDF error:', error);
    res.status(500).json({ error: 'Failed to add PDF.' });
  }
});

// ═══════════════════════════════════════════
// Remove PDF URL from Chapter (Admin)
// ═══════════════════════════════════════════

router.put('/:id/remove-pdf', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      res.status(400).json({ error: 'pdfUrl is required.' });
      return;
    }

    const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id as string } });
    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const currentPdfUrls: string[] = JSON.parse(chapter.pdfUrls || '[]');
    const updatedPdfUrls = currentPdfUrls.filter((url) => url !== pdfUrl);

    const updated = await prisma.chapter.update({
      where: { id: req.params.id as string },
      data: { pdfUrls: JSON.stringify(updatedPdfUrls) },
    });

    res.json({ chapter: mapChapter(updated) });
  } catch (error: any) {
    console.error('[Chapters] Remove PDF error:', error);
    res.status(500).json({ error: 'Failed to remove PDF.' });
  }
});

export default router;
