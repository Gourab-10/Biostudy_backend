// src/routes/notification.routes.ts
// ─── Broadcast Notification Routes ───
// GET  /api/notifications     → Get notification history
// POST /api/notifications     → Send broadcast notification (admin)

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════
// Get Broadcast Notifications
// ═══════════════════════════════════════════

router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await prisma.broadcastNotification.findMany({
      orderBy: { sentAt: 'desc' },
      take: limit,
    });

    res.json({ notifications });
  } catch (error: any) {
    console.error('[Notifications] Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// ═══════════════════════════════════════════
// Send Broadcast Notification (Admin)
// ═══════════════════════════════════════════

router.post('/', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, body, icon } = req.body;

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required.' });
      return;
    }

    const notification = await prisma.broadcastNotification.create({
      data: {
        title,
        body,
        icon: icon || '📢',
        sentBy: req.userId!,
      },
    });

    // TODO: Integrate with Expo Push Notification API to actually send push notifications
    // to all users with pushTokens. For now, it stores the notification record.
    // You can add this later:
    // const users = await prisma.user.findMany({ where: { pushToken: { not: null } } });
    // await sendExpoPushNotifications(users.map(u => u.pushToken!), { title, body });

    res.status(201).json({ notification });
  } catch (error: any) {
    console.error('[Notifications] Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

export default router;
