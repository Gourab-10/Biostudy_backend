import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userRole?: 'admin' | 'student';
        }
    }
}
/**
 * Middleware: Verify JWT token and attach userId + role to the request.
 */
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware: Require admin role.
 * Must be used AFTER authenticate middleware.
 */
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map