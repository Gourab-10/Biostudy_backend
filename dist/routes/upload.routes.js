"use strict";
// src/routes/upload.routes.ts
// ─── File Upload Routes ───
// POST /api/upload/pdf       → Upload PDF file (admin)
// POST /api/upload/avatar    → Upload avatar image (authenticated)
// DELETE /api/upload          → Delete a file (admin)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const uploadDir = process.env.UPLOAD_DIR || './uploads';
// ─── Multer Configuration ───
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path_1.default.resolve(uploadDir);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
        }
    },
});
// ═══════════════════════════════════════════
// Upload PDF (Admin)
// ═══════════════════════════════════════════
router.post('/pdf', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded.' });
            return;
        }
        // Construct the public URL for this file
        const fileUrl = `/uploads/${req.file.filename}`;
        res.status(201).json({
            message: 'File uploaded successfully.',
            fileUrl,
            fileName: req.file.originalname,
            size: req.file.size,
        });
    }
    catch (error) {
        console.error('[Upload] PDF upload error:', error);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
});
// ═══════════════════════════════════════════
// Upload Avatar (Authenticated User)
// ═══════════════════════════════════════════
router.post('/avatar', auth_middleware_1.authenticate, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded.' });
            return;
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        res.status(201).json({
            message: 'Avatar uploaded successfully.',
            avatarUrl: fileUrl,
        });
    }
    catch (error) {
        console.error('[Upload] Avatar upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar.' });
    }
});
// ═══════════════════════════════════════════
// Delete File (Admin)
// ═══════════════════════════════════════════
router.delete('/', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, (req, res) => {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) {
            res.status(400).json({ error: 'fileUrl is required.' });
            return;
        }
        // Extract filename from URL
        const filename = path_1.default.basename(fileUrl);
        const filePath = path_1.default.resolve(uploadDir, filename);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
            res.json({ message: 'File deleted.' });
        }
        else {
            res.status(404).json({ error: 'File not found.' });
        }
    }
    catch (error) {
        console.error('[Upload] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file.' });
    }
});
exports.default = router;
//# sourceMappingURL=upload.routes.js.map