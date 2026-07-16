# BioSpark Backend — VPS Deployment Guide

This guide walks you through deploying the BioSpark backend to your VPS server.

## Prerequisites

Your VPS needs:
- **Node.js 18+** (LTS recommended)
- **PostgreSQL 15+**
- **Nginx** (as reverse proxy)
- **PM2** (process manager for Node.js)

---

## ⚠️ IMPORTANT: Switch from Local SQLite to PostgreSQL Before Deploying

The backend is currently configured to use a **local SQLite database** for development.
Before deploying to your VPS, you **MUST** switch back to PostgreSQL. Make these changes:

### 1. Update `prisma/schema.prisma`
Change the datasource provider:
```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
}
```

### 2. Update `src/lib/prisma.ts`
Switch from the SQLite adapter to the PostgreSQL adapter:
```diff
- import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
+ import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient(): PrismaClient {
-  const adapter = new PrismaBetterSqlite3({
-    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
-  });
+  const connectionString = process.env.DATABASE_URL ||
+    'postgresql://biospark_user:your_secure_password@localhost:5432/biospark_db';
+  const adapter = new PrismaPg({ connectionString });
```

### 3. Update `.env`
Uncomment the Supabase/PostgreSQL URLs and remove the SQLite URL:
```diff
- # DATABASE_URL="postgresql://..."
- # DIRECT_URL="postgresql://..."
- DATABASE_URL="file:./prisma/dev.db"
+ DATABASE_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
+ DIRECT_URL="postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

### 4. Regenerate Prisma Client & Push Schema
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

---

## Step 1: Set Up PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Switch to postgres user and create DB + user
sudo -u postgres psql

CREATE USER biospark_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE biospark_db OWNER biospark_user;
GRANT ALL PRIVILEGES ON DATABASE biospark_db TO biospark_user;
\q
```

## Step 2: Upload Backend Code

```bash
# On your local machine, build the backend
cd biospark_backend
npm run build

# Upload to VPS (via scp, rsync, or git)
scp -r dist/ package.json package-lock.json prisma/ .env.example user@your-vps-ip:/home/user/biospark_backend/
```

## Step 3: Configure Environment

```bash
# On the VPS
cd /home/user/biospark_backend

# Copy and edit the environment file
cp .env.example .env
nano .env
```

Update these values in `.env`:
```
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://biospark_user:your_secure_password_here@localhost:5432/biospark_db"
JWT_SECRET="generate_a_64_char_random_string_here"
JWT_EXPIRES_IN="7d"
UPLOAD_DIR="/home/user/biospark_backend/uploads"
FRONTEND_URL="*"
```

## Step 4: Install Dependencies & Run Migrations

```bash
npm install --production
npx prisma db push      # Creates all tables
npm run db:seed          # Seeds initial admin + sample data
```

## Step 5: Start with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the backend
pm2 start dist/index.js --name biospark-api

# Auto-restart on reboot
pm2 startup
pm2 save
```

## Step 6: Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/biospark-api
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # or your VPS IP

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /home/user/biospark_backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/biospark-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 7: SSL Certificate (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Step 8: Update the Expo App

In `src/config/api.ts`, update the `PROD_URL`:
```typescript
const PROD_URL = 'https://api.yourdomain.com';
```

---

## API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/verify` | Yes | Verify JWT token |
| GET | `/api/users/profile` | Yes | Get profile |
| PUT | `/api/users/profile` | Yes | Update profile |
| PUT | `/api/users/push-token` | Yes | Save push token |
| GET | `/api/users/quiz-scores` | Yes | Get quiz history |
| GET | `/api/users/progress/:classNum` | Yes | Get study progress |
| PUT | `/api/users/progress` | Yes | Update progress |
| GET | `/api/chapters` | No | Get chapters |
| GET | `/api/chapters/:id` | No | Get single chapter |
| POST | `/api/chapters` | Admin | Create chapter |
| PUT | `/api/chapters/:id` | Admin | Update chapter |
| DELETE | `/api/chapters/:id` | Admin | Delete chapter |
| GET | `/api/quizzes` | Yes | Get quiz questions |
| POST | `/api/quizzes` | Admin | Add question |
| POST | `/api/quizzes/submit` | Yes | Submit quiz result |
| GET | `/api/lectures` | No | Get free lectures |
| POST | `/api/lectures` | Admin | Add lecture |
| DELETE | `/api/lectures/:id` | Admin | Delete lecture |
| GET | `/api/notifications` | Yes | Get notifications |
| POST | `/api/notifications` | Admin | Send notification |
| GET | `/api/access-codes` | Admin | Get access codes |
| POST | `/api/access-codes` | Admin | Generate code |
| POST | `/api/access-codes/redeem` | Yes | Redeem code |
| GET | `/api/chat` | Yes | Get chat history |
| POST | `/api/chat` | Yes | Send message |
| DELETE | `/api/chat` | Yes | Clear history |
| POST | `/api/upload/pdf` | Admin | Upload PDF |
| POST | `/api/upload/avatar` | Yes | Upload avatar |
| GET | `/api/admin/stats` | Admin | Dashboard stats |
| GET | `/api/admin/users` | Admin | List all users |
| PUT | `/api/admin/users/:id/role` | Admin | Change role |
| GET | `/api/health` | No | Health check |

---

## Default Credentials (from seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@biospark.app | admin123 |
| Student | student@biospark.app | student123 |

> ⚠️ **Change these passwords immediately in production!**
