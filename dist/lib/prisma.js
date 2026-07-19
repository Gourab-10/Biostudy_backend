"use strict";
// src/lib/prisma.ts
// ─── Prisma Client Singleton ───
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = globalThis;
function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/biospark_db';
    const pool = new pg_1.Pool({ connectionString });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
}
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
exports.default = exports.prisma;
//# sourceMappingURL=prisma.js.map