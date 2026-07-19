// src/routes/upload.routes.ts
// ─── File Upload Routes ───
// POST /api/upload/pdf       → Upload PDF file (admin)
// POST /api/upload/avatar    → Upload avatar image (authenticated)
// DELETE /api/upload          → Delete a file (admin)

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// ─── Multer Configuration ───
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(uploadDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
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
    } else {
      cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
    }
  },
});

// ═══════════════════════════════════════════
// Upload PDF (Admin)
// ═══════════════════════════════════════════

router.post('/pdf', authenticate, requireAdmin, upload.single('file'), (req: Request, res: Response): void => {
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
  } catch (error: any) {
    console.error('[Upload] PDF upload error:', error);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
});

// ═══════════════════════════════════════════
// Upload Avatar (Authenticated User)
// ═══════════════════════════════════════════

router.post('/avatar', authenticate, upload.single('file'), (req: Request, res: Response): void => {
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
  } catch (error: any) {
    console.error('[Upload] Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar.' });
  }
});

// ═══════════════════════════════════════════
// Delete File (Admin)
// ═══════════════════════════════════════════

router.delete('/', authenticate, requireAdmin, (req: Request, res: Response): void => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      res.status(400).json({ error: 'fileUrl is required.' });
      return;
    }

    // Extract filename from URL
    const filename = path.basename(fileUrl);
    const filePath = path.resolve(uploadDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted.' });
    } else {
      res.status(404).json({ error: 'File not found.' });
    }
  } catch (error: any) {
    console.error('[Upload] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

export default router;

