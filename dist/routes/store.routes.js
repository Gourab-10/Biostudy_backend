"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// GET all store items (publicly accessible so students can see the store)
router.get('/', async (_req, res) => {
    try {
        const storeItems = await prisma_1.prisma.storeItem.findMany({
            orderBy: { createdAt: 'asc' },
        });
        res.json({ storeItems });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch store items' });
    }
});
// POST add a new store item (Admin only)
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { title, classLabel, badge, rating, enrolled, instructor, price, color, whatsappNumber, whatsappText } = req.body;
        const newItem = await prisma_1.prisma.storeItem.create({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add store item', details: error.message });
    }
});
// PUT update a store item (Admin only)
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, classLabel, badge, rating, enrolled, instructor, price, color, whatsappNumber, whatsappText } = req.body;
        const updatedItem = await prisma_1.prisma.storeItem.update({
            where: { id: id },
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update store item', details: error.message });
    }
});
// DELETE a store item (Admin only)
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.storeItem.delete({
            where: { id: id },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete store item', details: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=store.routes.js.map