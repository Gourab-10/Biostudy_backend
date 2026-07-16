// @ts-nocheck
// prisma.config.ts
// ─── Prisma 7 Configuration ───
// Connection URLs are configured here instead of in schema.prisma.

import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
});
