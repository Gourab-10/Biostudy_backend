"use strict";
// src/routes/notification.routes.ts
// ─── Broadcast Notification Routes ───
// GET  /api/notifications     → Get notification history
// POST /api/notifications     → Send broadcast notification (admin)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Get Broadcast Notifications
// ═══════════════════════════════════════════
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const notifications = await prisma_1.default.broadcastNotification.findMany({
            orderBy: { sentAt: 'desc' },
            take: limit,
        });
        res.json({ notifications });
    }
    catch (error) {
        console.error('[Notifications] Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});
// ═══════════════════════════════════════════
// Send Broadcast Notification (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { title, body, icon } = req.body;
        if (!title || !body) {
            res.status(400).json({ error: 'title and body are required.' });
            return;
        }
        const notification = await prisma_1.default.broadcastNotification.create({
            data: {
                title,
                body,
                icon: icon || '📢',
                sentBy: req.userId,
            },
        });
        // TODO: Integrate with Expo Push Notification API to actually send push notifications
        // to all users with pushTokens. For now, it stores the notification record.
        // You can add this later:
        // const users = await prisma.user.findMany({ where: { pushToken: { not: null } } });
        // await sendExpoPushNotifications(users.map(u => u.pushToken!), { title, body });
        res.status(201).json({ notification });
    }
    catch (error) {
        console.error('[Notifications] Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification.' });
    }
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map