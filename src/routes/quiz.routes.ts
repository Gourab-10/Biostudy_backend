// src/routes/quiz.routes.ts
// ─── Dynamic Quiz Routes ───
// Student Endpoints:
// GET  /api/quizzes/active              → Get active dynamic quizzes (classNum filter, time period filter)
// GET  /api/quizzes/detail/:id          → Get full details & questions for a quiz
// GET  /api/quizzes/my-attempts         → Get current user's quiz attempt history
// POST /api/quizzes/submit              → Submit quiz result
// GET  /api/quizzes                     → Legacy get questions (chapterId/classNum filter)

// Admin Endpoints:
// GET    /api/quizzes/admin/all         → Get all quizzes for admin panel
// POST   /api/quizzes/admin/create      → Create new dynamic quiz with timer & schedule
// PUT    /api/quizzes/admin/:id         → Update quiz settings (timer, schedule, active status)
// DELETE /api/quizzes/admin/:id         → Delete quiz
// POST   /api/quizzes/admin/:id/questions → Add question to a quiz
// DELETE /api/quizzes/admin/questions/:qId → Delete quiz question

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { cleanupExpiredQuizzes } from '../lib/cleanup';

const router = Router();

// ═══════════════════════════════════════════
// STUDENT: Get Active Quizzes
// ═══════════════════════════════════════════

router.get('/active', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await cleanupExpiredQuizzes();

    const classNumParam = req.query.classNum ? parseInt(req.query.classNum as string) : undefined;
    const now = new Date();

    // Fetch active quizzes where startsAt <= now and (expiresAt is null or expiresAt >= now)
    const quizzes = await prisma.quiz.findMany({
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
  } catch (error: any) {
    console.error('[Quiz] Get active quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch active quizzes.' });
  }
});

// ═══════════════════════════════════════════
// STUDENT: Get Quiz Details & Questions
// ═══════════════════════════════════════════

router.get('/detail/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id as string },
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
      let parsedOpts: string[] = [];
      try {
        parsedOpts = JSON.parse(q.options);
      } catch (e) {
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
  } catch (error: any) {
    console.error('[Quiz] Get quiz detail error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz detail.' });
  }
});

// ═══════════════════════════════════════════
// STUDENT: Get Attempt History
// ═══════════════════════════════════════════

router.get('/my-attempts', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const attempts = await prisma.quizScore.findMany({
      where: { userId: req.userId! },
      include: {
        quiz: { select: { id: true, title: true, durationMinutes: true } },
        chapter: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    res.json({ attempts });
  } catch (error: any) {
    console.error('[Quiz] Get attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch attempt history.' });
  }
});

// ═══════════════════════════════════════════
// STUDENT: Submit Quiz Result (one attempt only)
// ═══════════════════════════════════════════

router.post('/submit', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { quizId, chapterId, chapterName, score, totalQuestions, accuracy, timeTakenSec } = req.body;

    if (score === undefined || totalQuestions === undefined || accuracy === undefined) {
      res.status(400).json({ error: 'score, totalQuestions, and accuracy are required.' });
      return;
    }

    // ─── Prevent duplicate attempts ───
    // Check if the user already submitted for this specific quiz or chapter
    const existingAttempt = await prisma.quizScore.findFirst({
      where: {
        userId: req.userId!,
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
      const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
      if (quiz) resolvedChapterName = quiz.title;
    }

    // 1. Save the quiz score record
    const quizScore = await prisma.quizScore.create({
      data: {
        userId: req.userId!,
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
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { totalQuizzes: true, averageScore: true },
    });

    if (user) {
      const prevTotal = user.totalQuizzes;
      const prevAvg = user.averageScore;
      const newTotal = prevTotal + 1;
      const newAvg = Math.round((prevAvg * prevTotal + Number(accuracy)) / newTotal);

      await prisma.user.update({
        where: { id: req.userId },
        data: {
          totalQuizzes: newTotal,
          averageScore: newAvg,
        },
      });
    }

    res.status(201).json({ quizScore });
  } catch (error: any) {
    console.error('[Quiz] Submit result error:', error);
    res.status(500).json({ error: 'Failed to submit quiz result.' });
  }
});

// ═══════════════════════════════════════════
// STUDENT: Get My Quiz Scores (completed quizzes)
// ═══════════════════════════════════════════

router.get('/my-scores', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const scores = await prisma.quizScore.findMany({
      where: { userId: req.userId! },
      orderBy: { completedAt: 'desc' },
    });

    res.json({ scores });
  } catch (error: any) {
    console.error('[Quiz] Get my scores error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz scores.' });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Fetch All Quizzes
// ═══════════════════════════════════════════

router.get('/admin/all', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const quizzes = await prisma.quiz.findMany({
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
        } catch (e) {
          opts = [q.options];
        }
        return { ...q, options: opts };
      }),
    }));

    res.json({ quizzes: formattedQuizzes });
  } catch (error: any) {
    console.error('[Quiz Admin] Get all quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes.' });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Create Dynamic Quiz
// ═══════════════════════════════════════════

router.post('/admin/create', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, classNum, chapterId, durationMinutes, startsAt, expiresAt, isActive, secretKey } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Quiz title is required.' });
      return;
    }

    const quiz = await prisma.quiz.create({
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
  } catch (error: any) {
    console.error('[Quiz Admin] Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz.' });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Update Dynamic Quiz
// ═══════════════════════════════════════════

router.put('/admin/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, classNum, chapterId, durationMinutes, startsAt, expiresAt, isActive, secretKey } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (classNum !== undefined) updateData.classNum = Number(classNum);
    if (chapterId !== undefined) updateData.chapterId = chapterId || null;
    if (durationMinutes !== undefined) updateData.durationMinutes = Number(durationMinutes);
    if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : new Date();
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (secretKey !== undefined) updateData.secretKey = secretKey || null;

    const quiz = await prisma.quiz.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json({ quiz });
  } catch (error: any) {
    console.error('[Quiz Admin] Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz.' });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Delete Quiz
// ═══════════════════════════════════════════

router.delete('/admin/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  if (id.startsWith('mock-')) {
    res.json({ message: 'Mock quiz deleted.' });
    return;
  }
  try {
    await prisma.quiz.delete({
      where: { id },
    });
    res.json({ message: 'Quiz deleted successfully.' });
  } catch (error: any) {
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

router.post('/admin/:id/questions', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const quizId = req.params.id as string;
    const { text, options, correctIndex, explanation } = req.body;

    if (!text || !options || correctIndex === undefined || explanation === undefined) {
      res.status(400).json({ error: 'text, options, correctIndex, and explanation are required.' });
      return;
    }

    if (!Array.isArray(options) || options.length !== 4) {
      res.status(400).json({ error: 'options must be an array of 4 strings.' });
      return;
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found.' });
      return;
    }

    const question = await prisma.quizQuestion.create({
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
  } catch (error: any) {
    console.error('[Quiz Admin] Add question error:', error);
    res.status(500).json({ error: 'Failed to add question.' });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Delete Question
// ═══════════════════════════════════════════

router.delete('/admin/questions/:qId', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const qId = req.params.qId as string;
  if (qId.startsWith('mock-')) {
    res.json({ message: 'Mock question deleted.' });
    return;
  }
  try {
    await prisma.quizQuestion.delete({
      where: { id: qId },
    });
    res.json({ message: 'Question deleted successfully.' });
  } catch (error: any) {
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

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await cleanupExpiredQuizzes();

    const classNum = req.query.classNum ? parseInt(req.query.classNum as string) : undefined;
    const chapterId = req.query.chapterId as string | undefined;

    const where: any = {};
    if (classNum !== undefined) where.classNum = classNum;
    if (chapterId) where.chapterId = chapterId;

    const questions = await prisma.quizQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ questions });
  } catch (error: any) {
    console.error('[Quiz] Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions.' });
  }
});

// ═══════════════════════════════════════════
// LEGACY: Add Question (Admin)
// ═══════════════════════════════════════════

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { chapterId, classNum, text, options, correctIndex, explanation } = req.body;

    if (!chapterId || !text || !options || correctIndex === undefined || explanation === undefined) {
      res.status(400).json({ error: 'chapterId, text, options, correctIndex, and explanation are required.' });
      return;
    }

    if (!Array.isArray(options) || options.length !== 4) {
      res.status(400).json({ error: 'options must be an array of 4 strings.' });
      return;
    }

    const question = await prisma.quizQuestion.create({
      data: {
        chapterId,
        classNum: classNum ? parseInt(classNum) : 11,
        text,
        options: JSON.stringify(options),
        correctIndex,
        explanation,
      },
    });

    res.status(201).json({ question });
  } catch (error: any) {
    console.error('[Quiz] Add legacy question error:', error);
    res.status(500).json({ error: 'Failed to add question.' });
  }
});

// ═══════════════════════════════════════════
// LEGACY: Update Question (Admin)
// ═══════════════════════════════════════════

router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, options, correctIndex, explanation } = req.body;
    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (options !== undefined) updateData.options = JSON.stringify(options);
    if (correctIndex !== undefined) updateData.correctIndex = correctIndex;
    if (explanation !== undefined) updateData.explanation = explanation;

    const question = await prisma.quizQuestion.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json({ question });
  } catch (error: any) {
    console.error('[Quiz] Update legacy question error:', error);
    res.status(500).json({ error: 'Failed to update question.' });
  }
});

// ═══════════════════════════════════════════
// LEGACY: Delete Question (Admin)
// ═══════════════════════════════════════════

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  if (id.startsWith('mock-')) {
    res.json({ message: 'Mock question deleted.' });
    return;
  }
  try {
    await prisma.quizQuestion.delete({
      where: { id: id },
    });
    res.json({ message: 'Question deleted.' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.json({ message: 'Question already deleted.' });
      return;
    }
    console.error('[Quiz] Delete legacy question error:', error);
    res.status(500).json({ error: 'Failed to delete question.' });
  }
});

export default router;
