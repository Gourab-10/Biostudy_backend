"use strict";
// src/middleware/auth.middleware.ts
// ─── JWT Authentication & Role-Based Access Middleware ───
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Middleware: Verify JWT token and attach userId + role to the request.
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Access denied. No token provided.' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // Verify user still exists in DB
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true },
        });
        if (!user) {
            res.status(401).json({ error: 'User no longer exists.' });
            return;
        }
        req.userId = user.id;
        req.userRole = user.role;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Token expired. Please login again.' });
            return;
        }
        res.status(401).json({ error: 'Invalid token.' });
    }
};
exports.authenticate = authenticate;
/**
 * Middleware: Require admin role.
 * Must be used AFTER authenticate middleware.
 */
const requireAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        res.status(403).json({ error: 'Admin access required.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.middleware.js.map