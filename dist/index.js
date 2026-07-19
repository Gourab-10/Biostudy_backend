"use strict";
// src/index.ts
// ─── BioStudy Backend Server ───
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables
dotenv_1.default.config();
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const chapter_routes_1 = __importDefault(require("./routes/chapter.routes"));
const quiz_routes_1 = __importDefault(require("./routes/quiz.routes"));
const lecture_routes_1 = __importDefault(require("./routes/lecture.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const accessCode_routes_1 = __importDefault(require("./routes/accessCode.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const notes_routes_1 = __importDefault(require("./routes/notes.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// ═══════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Dynamically allow any origin for local development with Expo
        callback(null, true);
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Serve uploaded files statically
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(path_1.default.resolve(uploadDir)));
// ═══════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/chapters', chapter_routes_1.default);
app.use('/api/quizzes', quiz_routes_1.default);
app.use('/api/lectures', lecture_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/access-codes', accessCode_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/notes', notes_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ═══════════════════════════════════════════
// Error Handler
// ═══════════════════════════════════════════
app.use((err, _req, res, _next) => {
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
});
exports.default = app;
//# sourceMappingURL=index.js.map