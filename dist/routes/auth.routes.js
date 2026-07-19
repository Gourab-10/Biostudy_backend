"use strict";
// src/routes/auth.routes.ts
// ─── Authentication Routes ───
// POST /api/auth/register  → Register new user
// POST /api/auth/login     → Login existing user
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Register
// ═══════════════════════════════════════════
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName, selectedClass } = req.body;
        if (!email || !password || !displayName) {
            res.status(400).json({ error: 'email, password, and displayName are required.' });
            return;
        }
        // Check if user already exists
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'An account with this email already exists.' });
            return;
        }
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        // Create user
        const user = await prisma_1.default.user.create({
            data: {
                email,
                passwordHash,
                displayName,
                selectedClass: selectedClass || 11,
                role: 'student',
            },
        });
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: 604800 } // 7 days in seconds
        );
        res.status(201).json({
            message: 'Registration successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                selectedClass: user.selectedClass,
                streak: user.streak,
                totalQuizzes: user.totalQuizzes,
                averageScore: user.averageScore,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Registration failed.' });
    }
});
// ═══════════════════════════════════════════
// Login
// ═══════════════════════════════════════════
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'email and password are required.' });
            return;
        }
        // Find user
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        // Verify password
        const valid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: 604800 } // 7 days in seconds
        );
        res.json({
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                selectedClass: user.selectedClass,
                avatarUrl: user.avatarUrl,
                streak: user.streak,
                totalQuizzes: user.totalQuizzes,
                averageScore: user.averageScore,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});
// ═══════════════════════════════════════════
// Verify Token (check if token is still valid)
// ═══════════════════════════════════════════
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ valid: false });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                selectedClass: true,
                avatarUrl: true,
                streak: true,
                totalQuizzes: true,
                averageScore: true,
                createdAt: true,
            },
        });
        if (!user) {
            res.status(401).json({ valid: false });
            return;
        }
        res.json({ valid: true, user });
    }
    catch {
        res.status(401).json({ valid: false });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map