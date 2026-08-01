import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET /api/leaderboard/:classId
// Fetch the latest leaderboard for a specific class
router.get('/:classId', async (req: Request, res: Response) => {
  try {
    const classIdStr = typeof req.params.classId === 'string' ? req.params.classId : String(req.params.classId);
    const classId = parseInt(classIdStr, 10);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class ID' });
    }

    const leaderboard = await prisma.leaderboard.findFirst({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      include: { students: true },
    });

    if (!leaderboard) {
      return res.json(null);
    }

    // Format the response to match the frontend expectations
    const formattedLeaderboard = {
      id: leaderboard.id,
      classId: leaderboard.classId,
      topicName: leaderboard.topicName,
      passMarks: leaderboard.passMarks,
      columns: JSON.parse(leaderboard.columns),
      sortByColumn: leaderboard.sortByColumn,
      createdAt: leaderboard.createdAt,
      students: leaderboard.students.map((s: any) => ({
        studentName: s.studentName,
        scores: JSON.parse(s.scores),
      })),
    };

    res.json(formattedLeaderboard);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: error.message });
  }
});

// POST /api/leaderboard
// Create a new leaderboard event (Admin only)
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { classId, topicName, passMarks, columns, sortByColumn, students } = req.body;

    if (!classId || !topicName || !columns || !sortByColumn || !students) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newLeaderboard = await prisma.leaderboard.create({
      data: {
        classId: Number(classId),
        topicName,
        passMarks: Number(passMarks) || 0,
        columns: JSON.stringify(columns),
        sortByColumn,
        students: {
          create: students.map((s: any) => ({
            studentName: s.studentName,
            scores: JSON.stringify(s.scores),
          })),
        },
      },
      include: { students: true },
    });

    const formattedLeaderboard = {
      id: newLeaderboard.id,
      classId: newLeaderboard.classId,
      topicName: newLeaderboard.topicName,
      passMarks: newLeaderboard.passMarks,
      columns: JSON.parse(newLeaderboard.columns),
      sortByColumn: newLeaderboard.sortByColumn,
      createdAt: newLeaderboard.createdAt,
      students: newLeaderboard.students.map((s: any) => ({
        studentName: s.studentName,
        scores: JSON.parse(s.scores),
      })),
    };

    res.status(201).json(formattedLeaderboard);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create leaderboard', details: error.message });
  }
});

// DELETE /api/leaderboard/:id
// Delete a leaderboard event (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    await prisma.leaderboard.delete({
      where: { id },
    });
    res.json({ message: 'Leaderboard deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete leaderboard', details: error.message });
  }
});

export default router;
