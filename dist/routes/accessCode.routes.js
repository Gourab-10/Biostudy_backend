"use strict";
// src/routes/accessCode.routes.ts
// ─── Access Code Routes ───
// GET    /api/access-codes          → Get all access codes (admin)
// POST   /api/access-codes          → Generate access code (admin)
// PUT    /api/access-codes/:id/toggle → Toggle active status (admin)
// POST   /api/access-codes/redeem   → Redeem access code (student)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Get All Access Codes (Admin)
// ═══════════════════════════════════════════
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.userId } });
        const isAdmin = user?.role === 'admin';
        let codes;
        if (isAdmin) {
            codes = await prisma_1.default.accessCode.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { redeemedBy: true } },
                },
            });
        }
        else {
            codes = await prisma_1.default.accessCode.findMany({
                where: {
                    redeemedBy: { some: { userId: req.userId } }
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        res.json({ codes });
    }
    catch (error) {
        console.error('[AccessCodes] Get codes error:', error);
        res.status(500).json({ error: 'Failed to fetch access codes.' });
    }
});
// ═══════════════════════════════════════════
// Generate Access Code (Admin)
// ═══════════════════════════════════════════
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { code, classNum, chapterId, maxUses, expiresAt } = req.body;
        if (!code || classNum === undefined) {
            res.status(400).json({ error: 'code and classNum are required.' });
            return;
        }
        // Check if code already exists
        const existing = await prisma_1.default.accessCode.findUnique({ where: { code } });
        if (existing) {
            res.status(409).json({ error: 'Access code already exists.' });
            return;
        }
        const accessCode = await prisma_1.default.accessCode.create({
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
    }
    catch (error) {
        console.error('[AccessCodes] Generate code error:', error);
        res.status(500).json({ error: 'Failed to generate access code.' });
    }
});
// ═══════════════════════════════════════════
// Toggle Access Code Status (Admin)
// ═══════════════════════════════════════════
router.put('/:id/toggle', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;
        const accessCode = await prisma_1.default.accessCode.update({
            where: { id: req.params.id },
            data: { isActive },
        });
        res.json({ accessCode });
    }
    catch (error) {
        console.error('[AccessCodes] Toggle status error:', error);
        res.status(500).json({ error: 'Failed to toggle access code status.' });
    }
});
// ═══════════════════════════════════════════
// Redeem Access Code (Student)
// ═══════════════════════════════════════════
router.post('/redeem', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ error: 'code is required.' });
            return;
        }
        // Find the access code
        const accessCode = await prisma_1.default.accessCode.findUnique({ where: { code } });
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
        const existingRedemption = await prisma_1.default.userAccessCode.findUnique({
            where: {
                userId_accessCodeId: {
                    userId: req.userId,
                    accessCodeId: accessCode.id,
                },
            },
        });
        if (existingRedemption) {
            res.status(400).json({ error: 'You have already redeemed this code.' });
            return;
        }
        // Create redemption record and increment uses (transaction)
        await prisma_1.default.$transaction([
            prisma_1.default.userAccessCode.create({
                data: {
                    userId: req.userId,
                    accessCodeId: accessCode.id,
                },
            }),
            prisma_1.default.accessCode.update({
                where: { id: accessCode.id },
                data: { currentUses: accessCode.currentUses + 1 },
            }),
        ]);
        res.json({ accessCode, message: 'Access code redeemed successfully.' });
    }
    catch (error) {
        console.error('[AccessCodes] Redeem code error:', error);
        res.status(500).json({ error: 'Failed to redeem access code.' });
    }
});
exports.default = router;
//# sourceMappingURL=accessCode.routes.js.map