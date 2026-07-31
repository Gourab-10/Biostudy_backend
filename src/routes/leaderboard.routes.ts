import { Router } from 'express';
import { db } from '../config/firebase';

const router = Router();

// GET /api/leaderboard/:classId
// Fetch the latest leaderboard for a specific class
router.get('/:classId', async (req, res) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class ID' });
    }

    const snapshot = await db.collection('leaderboards')
      .where('classId', '==', classId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json(null);
    }

    const doc = snapshot.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: error.message });
  }
});

// POST /api/leaderboard
// Create a new leaderboard event
router.post('/', async (req, res) => {
  try {
    const { classId, topicName, passMarks, columns, sortByColumn, students } = req.body;

    if (!classId || !topicName || !columns || !sortByColumn || !students) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newLeaderboard = {
      classId: Number(classId),
      topicName,
      passMarks: Number(passMarks) || 0,
      columns,
      sortByColumn,
      students,
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection('leaderboards').add(newLeaderboard);
    res.status(201).json({ id: docRef.id, ...newLeaderboard });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create leaderboard', details: error.message });
  }
});

// DELETE /api/leaderboard/:id
// Delete a leaderboard event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('leaderboards').doc(id).delete();
    res.json({ message: 'Leaderboard deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete leaderboard', details: error.message });
  }
});

export default router;
