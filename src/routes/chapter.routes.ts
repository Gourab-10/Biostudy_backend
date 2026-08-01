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

const mapChapter = async (ch: any, activeCodes?: any[]) => {
  let parsedPdfUrls = [];
  try {
    parsedPdfUrls = ch.pdfUrls ? JSON.parse(ch.pdfUrls) : [];
  } catch(e) {}

  const codes = activeCodes || await prisma.accessCode.findMany({
    where: { isActive: true },
    select: { classNum: true, chapterId: true },
  });

  const hasRestrictingCode = codes.some(c => 
    c.classNum === ch.classNum && 
    (c.chapterId === null || c.chapterId === ch.id)
  );

  return { 
    ...ch, 
    pdfUrls: parsedPdfUrls,
    requiresCode: hasRestrictingCode
  };
};



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

    const activeCodes = await prisma.accessCode.findMany({
      where: { isActive: true },
      select: { classNum: true, chapterId: true },
    });

    const mapped = await Promise.all(chapters.map(ch => mapChapter(ch, activeCodes)));

    res.json({ chapters: mapped });
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

    res.json({ chapter: await mapChapter(chapter) });
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
    const { classNum, number, name, topics, semester, quizTimeLimit, validityHours, subject } = req.body;

    if (!classNum || !number || !name) {
      res.status(400).json({ error: 'classNum, number, and name are required.' });
      return;
    }

    const parsedClassNum = parseInt(String(classNum), 10);
    if (isNaN(parsedClassNum)) {
      res.status(400).json({ error: 'classNum must be a valid integer.' });
      return;
    }

    let quizExpiresAt = null;
    if (validityHours && Number(validityHours) > 0) {
      quizExpiresAt = new Date(Date.now() + Number(validityHours) * 60 * 60 * 1000);
    }

    const chapter = await prisma.chapter.create({
      data: {
        classNum: parsedClassNum,
        number: String(number),
        name: String(name),
        topics: topics ? parseInt(String(topics), 10) : 0,
        semester: semester ? parseInt(String(semester), 10) : 1,
        quizTimeLimit: quizTimeLimit !== undefined && quizTimeLimit !== null && quizTimeLimit !== '' ? parseInt(String(quizTimeLimit), 10) : null,
        quizExpiresAt,
        pdfUrls: JSON.stringify([]),
        subject: subject || 'biology',
      },
    });

    res.status(201).json({ chapter: await mapChapter(chapter) });
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
    const { classNum, number, name, topics, semester, quizTimeLimit, validityHours, subject } = req.body;

    const updateData: any = {};
    if (classNum !== undefined) updateData.classNum = parseInt(String(classNum), 10);
    if (number !== undefined) updateData.number = String(number);
    if (name !== undefined) updateData.name = String(name);
    if (topics !== undefined) updateData.topics = parseInt(String(topics), 10);
    if (semester !== undefined) updateData.semester = parseInt(String(semester), 10);
    if (quizTimeLimit !== undefined) updateData.quizTimeLimit = (quizTimeLimit !== null && quizTimeLimit !== '') ? parseInt(String(quizTimeLimit), 10) : null;
    if (subject !== undefined) updateData.subject = String(subject);
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

    res.json({ chapter: await mapChapter(chapter) });
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

    res.json({ chapter: await mapChapter(updated) });
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

    res.json({ chapter: await mapChapter(updated) });
  } catch (error: any) {
    console.error('[Chapters] Remove PDF error:', error);
    res.status(500).json({ error: 'Failed to remove PDF.' });
  }
});

export default router;
