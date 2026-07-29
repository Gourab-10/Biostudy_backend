import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET all store items (publicly accessible so students can see the store)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const storeItems = await prisma.storeItem.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ storeItems });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

// POST add a new store item (Admin only)
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, classLabel, badge, rating, enrolled, instructor, price, color, whatsappNumber, whatsappText } = req.body;
    const newItem = await prisma.storeItem.create({
      data: {
        title,
        classLabel,
        badge,
        rating: rating || "4.5",
        enrolled: enrolled || "0",
        instructor,
        price,
        color: color || "#10B981",
        whatsappNumber,
        whatsappText,
      },
    });
    res.json({ storeItem: newItem });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add store item', details: error.message });
  }
});

// PUT update a store item (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, classLabel, badge, rating, enrolled, instructor, price, color, whatsappNumber, whatsappText } = req.body;
    
    const updatedItem = await prisma.storeItem.update({
      where: { id: id as string },
      data: {
        title,
        classLabel,
        badge,
        rating,
        enrolled,
        instructor,
        price,
        color,
        whatsappNumber,
        whatsappText,
      },
    });
    res.json({ storeItem: updatedItem });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update store item', details: error.message });
  }
});

// DELETE a store item (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.storeItem.delete({
      where: { id: id as string },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete store item', details: error.message });
  }
});

export default router;
