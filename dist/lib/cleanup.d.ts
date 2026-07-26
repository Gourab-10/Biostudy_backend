/**
 * Automatically deletes all quiz questions from the database for chapters
 * whose quiz expiration time (quizExpiresAt) has already passed.
 */
export declare function cleanupExpiredQuizzes(): Promise<void>;
/**
 * Starts a background interval to run the cleanup task periodically.
 * @param intervalMs How often to run the cleanup in milliseconds (defaults to 5 minutes)
 */
export declare function startCleanupInterval(intervalMs?: number): void;
//# sourceMappingURL=cleanup.d.ts.map