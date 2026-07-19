"use strict";
// src/routes/notes.routes.ts
// ─── PDF Notes Routes (Access-Code Gated) ───
// POST   /api/notes/verify-code      → Verify an access code and get available notes
// GET    /api/notes/download/:id      → Download a PDF (requires valid code in query param)
// POST   /api/notes/generate-code     → Admin generates a notes access code
// GET    /api/notes/codes             → Admin lists all notes access codes
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════
// Verify Access Code & List Available Notes
// ═══════════════════════════════════════════
// Student provides a code → we validate it and return the list of
// chapters (with their PDF URLs) that the code grants access to.
router.post('/verify-code', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Access code is required.' });
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
        // Determine which chapters this code unlocks
        let chapters;
        if (accessCode.chapterId) {
            // Specific chapter
            chapters = await prisma_1.default.chapter.findMany({
                where: { id: accessCode.chapterId },
                select: {
                    id: true,
                    classNum: true,
                    number: true,
                    name: true,
                    pdfUrls: true,
                },
            });
        }
        else {
            // All chapters for the given classNum
            chapters = await prisma_1.default.chapter.findMany({
                where: { classNum: accessCode.classNum },
                orderBy: { number: 'asc' },
                select: {
                    id: true,
                    classNum: true,
                    number: true,
                    name: true,
                    pdfUrls: true,
                },
            });
        }
        // Parse pdfUrls and filter chapters that actually have PDFs
        const notesAvailable = chapters
            .map((ch) => {
            const pdfs = JSON.parse(ch.pdfUrls || '[]');
            return {
                chapterId: ch.id,
                classNum: ch.classNum,
                chapterNumber: ch.number,
                chapterName: ch.name,
                pdfCount: pdfs.length,
                pdfs: pdfs.map((url, index) => ({
                    index,
                    url,
                    downloadUrl: `/api/notes/view/${ch.id}?code=${code}&pdfIndex=${index}`,
                })),
            };
        })
            .filter((ch) => ch.pdfCount > 0);
        res.json({
            valid: true,
            code: accessCode.code,
            classNum: accessCode.classNum,
            chapters: notesAvailable,
            message: notesAvailable.length > 0
                ? `Access granted! ${notesAvailable.length} chapter(s) with notes available.`
                : 'Access granted, but no PDF notes have been uploaded for these chapters yet.',
        });
    }
    catch (error) {
        console.error('[Notes] Verify code error:', error);
        res.status(500).json({ error: 'Failed to verify access code.' });
    }
});
// ═══════════════════════════════════════════
// Download PDF (Code-Gated)
// ═══════════════════════════════════════════
// GET /api/notes/download/:chapterId?code=XXXX&pdfIndex=0
router.get('/download/:chapterId', async (req, res) => {
    try {
        const { code, pdfIndex } = req.query;
        const chapterId = req.params.chapterId;
        if (!code) {
            res.status(400).json({ error: 'Access code is required as a query parameter.' });
            return;
        }
        // Validate the code
        const accessCode = await prisma_1.default.accessCode.findUnique({ where: { code: code } });
        if (!accessCode || !accessCode.isActive) {
            res.status(403).json({ error: 'Invalid or inactive access code.' });
            return;
        }
        if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
            res.status(403).json({ error: 'Access code has expired.' });
            return;
        }
        if (accessCode.maxUses !== -1 && accessCode.currentUses >= accessCode.maxUses) {
            res.status(403).json({ error: 'Access code has reached its maximum uses.' });
            return;
        }
        // Verify this code grants access to the requested chapter
        if (accessCode.chapterId && accessCode.chapterId !== chapterId) {
            res.status(403).json({ error: 'This access code does not grant access to this chapter.' });
            return;
        }
        // Fetch the chapter
        const chapter = await prisma_1.default.chapter.findUnique({ where: { id: chapterId } });
        if (!chapter) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        // Also verify classNum matches
        if (chapter.classNum !== accessCode.classNum) {
            res.status(403).json({ error: 'This access code does not grant access to this class.' });
            return;
        }
        const pdfs = JSON.parse(chapter.pdfUrls || '[]');
        const idx = parseInt(pdfIndex) || 0;
        if (idx < 0 || idx >= pdfs.length) {
            res.status(404).json({ error: 'PDF not found at this index.' });
            return;
        }
        const pdfUrl = pdfs[idx];
        // If the PDF URL is a local path (starts with /uploads/), serve the file
        if (pdfUrl.startsWith('/uploads/')) {
            const uploadDir = process.env.UPLOAD_DIR || './uploads';
            const filename = path_1.default.basename(pdfUrl);
            const filePath = path_1.default.resolve(uploadDir, filename);
            if (!fs_1.default.existsSync(filePath)) {
                res.status(404).json({ error: 'PDF file not found on server.' });
                return;
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="Ch${chapter.number}-${chapter.name.replace(/\s+/g, '-')}.pdf"`);
            const stream = fs_1.default.createReadStream(filePath);
            stream.pipe(res);
            return;
        }
        // If it's an external URL, redirect
        res.redirect(pdfUrl);
    }
    catch (error) {
        console.error('[Notes] Download error:', error);
        res.status(500).json({ error: 'Failed to download PDF.' });
    }
});
// ═══════════════════════════════════════════
// View PDF Inline (HTML Viewer using PDF.js)
// ═══════════════════════════════════════════
// GET /api/notes/view/:chapterId?code=XXXX&pdfIndex=0
router.get('/view/:chapterId', async (req, res) => {
    const { code, pdfIndex } = req.query;
    const chapterId = req.params.chapterId;
    if (!code) {
        res.status(400).send('Access code is required.');
        return;
    }
    // The actual PDF data URL
    const downloadUrl = `/api/notes/download/${chapterId}?code=${encodeURIComponent(code)}&pdfIndex=${pdfIndex || 0}`;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
  <title>PDF Viewer</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; display: flex; flex-direction: column; align-items: center; overflow-x: hidden; }
    .pdf-page { margin: 8px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; max-width: 100%; }
    #loader { padding: 20px; font-family: sans-serif; color: #64748b; font-weight: bold; }
  </style>
</head>
<body>
  <div id="loader">Loading document...</div>
  <div id="pdf-container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const url = '${downloadUrl}';
    
    pdfjsLib.getDocument(url).promise.then(pdf => {
      document.getElementById('loader').style.display = 'none';
      const container = document.getElementById('pdf-container');
      
      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        pdf.getPage(pageNum).then(page => {
          // Responsive scaling based on device width
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const scale = Math.min((window.innerWidth - 16) / unscaledViewport.width, 2.0);
          const viewport = page.getViewport({ scale: scale });
          
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page';
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Insert in correct order
          canvas.dataset.page = pageNum;
          
          const wrapper = document.createElement('div');
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          
          // Sort the canvases so they stay in order even if async rendering finishes out of order
          const wrappers = Array.from(container.children);
          wrappers.sort((a, b) => parseInt(a.firstChild.dataset.page) - parseInt(b.firstChild.dataset.page));
          wrappers.forEach(w => container.appendChild(w));

          page.render({ canvasContext: context, viewport: viewport });
        });
      }
    }).catch(err => {
      document.getElementById('loader').innerText = 'Error loading PDF: ' + err.message;
    });
  </script>
</body>
</html>
  `;
    res.send(html);
});
// ═══════════════════════════════════════════
// Generate Notes Access Code (Admin)
// ═══════════════════════════════════════════
router.post('/generate-code', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (req, res) => {
    try {
        const { classNum, chapterId, maxUses, expiresInHours } = req.body;
        if (classNum === undefined) {
            res.status(400).json({ error: 'classNum is required.' });
            return;
        }
        // Auto-generate a readable code: NOTES-XXXXX
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const generatedCode = `NOTES-${randomPart}`;
        // Check uniqueness
        const existing = await prisma_1.default.accessCode.findUnique({ where: { code: generatedCode } });
        if (existing) {
            // Extremely unlikely collision — just retry with different random
            const retry = Math.random().toString(36).substring(2, 8).toUpperCase();
            const retryCode = `NOTES-${retry}`;
            const accessCode = await prisma_1.default.accessCode.create({
                data: {
                    code: retryCode,
                    classNum,
                    chapterId: chapterId || null,
                    maxUses: maxUses ?? -1,
                    isActive: true,
                    expiresAt: expiresInHours
                        ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000)
                        : null,
                },
            });
            res.status(201).json({
                accessCode,
                message: `Notes access code generated: ${retryCode}`,
            });
            return;
        }
        const accessCode = await prisma_1.default.accessCode.create({
            data: {
                code: generatedCode,
                classNum,
                chapterId: chapterId || null,
                maxUses: maxUses ?? -1,
                isActive: true,
                expiresAt: expiresInHours
                    ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000)
                    : null,
            },
        });
        res.status(201).json({
            accessCode,
            message: `Notes access code generated: ${generatedCode}`,
        });
    }
    catch (error) {
        console.error('[Notes] Generate code error:', error);
        res.status(500).json({ error: 'Failed to generate notes access code.' });
    }
});
// ═══════════════════════════════════════════
// List Notes Access Codes (Admin)
// ═══════════════════════════════════════════
router.get('/codes', auth_middleware_1.authenticate, auth_middleware_1.requireAdmin, async (_req, res) => {
    try {
        const codes = await prisma_1.default.accessCode.findMany({
            where: {
                code: { startsWith: 'NOTES-' },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { redeemedBy: true } },
            },
        });
        res.json({ codes });
    }
    catch (error) {
        console.error('[Notes] List codes error:', error);
        res.status(500).json({ error: 'Failed to fetch notes access codes.' });
    }
});
exports.default = router;
//# sourceMappingURL=notes.routes.js.map