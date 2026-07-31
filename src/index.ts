// src/index.ts
// ─── BioStudy Backend Server ───

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { startCleanupInterval } from './lib/cleanup';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chapterRoutes from './routes/chapter.routes';
import quizRoutes from './routes/quiz.routes';
import lectureRoutes from './routes/lecture.routes';
import notificationRoutes from './routes/notification.routes';
import accessCodeRoutes from './routes/accessCode.routes';
import chatRoutes from './routes/chat.routes';
import uploadRoutes from './routes/upload.routes';
import adminRoutes from './routes/admin.routes';
import notesRoutes from './routes/notes.routes';
import attendanceRoutes from './routes/attendance.routes';
import storeRoutes from './routes/store.routes';

const app = express();
const PORT = process.env.PORT || 5000;

// ═══════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════

app.use(cors({
  origin: function (origin, callback) {
    // Dynamically allow any origin for local development with Expo
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically with proper headers for mobile clients
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(uploadDir), {
  setHeaders: (res, filePath) => {
    // Explicitly set Content-Type for PDF files (some proxies strip it)
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    // Allow cross-origin access (needed for React Native fetch)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Cache for 1 hour on mobile to reduce re-fetches
    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// ═══════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/access-codes', accessCodeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/store', storeRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════
// Error Handler
// ═══════════════════════════════════════════

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ═══════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 BioStudy Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/health`);
  startCleanupInterval();
});

export default app;
