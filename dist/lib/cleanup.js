"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredQuizzes = cleanupExpiredQuizzes;
exports.startCleanupInterval = startCleanupInterval;
// src/lib/cleanup.ts
const prisma_1 = __importDefault(require("./prisma"));
/**
 * Automatically deletes all quiz questions from the database for chapters
 * whose quiz expiration time (quizExpiresAt) has already passed.
 */
async function cleanupExpiredQuizzes() {
    try {
        const now = new Date();
        // Find all chapters that have expired
        const expiredChapters = await prisma_1.default.chapter.findMany({
            where: {
                quizExpiresAt: {
                    lt: now,
                },
            },
            select: { id: true },
        });
        if (expiredChapters.length > 0) {
            const expiredIds = expiredChapters.map((ch) => ch.id);
            // Delete questions associated with the expired chapters
            const deleteResult = await prisma_1.default.quizQuestion.deleteMany({
                where: {
                    chapterId: { in: expiredIds },
                },
            });
            if (deleteResult.count > 0) {
                console.log(`[Cleanup] Deleted ${deleteResult.count} expired quiz questions for chapters: [${expiredIds.join(', ')}]`);
            }
        }
    }
    catch (error) {
        console.error('[Cleanup] Error cleaning up expired quizzes:', error);
    }
}
/**
 * Starts a background interval to run the cleanup task periodically.
 * @param intervalMs How often to run the cleanup in milliseconds (defaults to 5 minutes)
 */
function startCleanupInterval(intervalMs = 5 * 60 * 1000) {
    console.log('⏰ Starting background cleanup worker for expired quizzes...');
    // Run once immediately on startup
    cleanupExpiredQuizzes();
    // Schedule periodic runs
    setInterval(async () => {
        await cleanupExpiredQuizzes();
    }, intervalMs);
}
//# sourceMappingURL=cleanup.js.map