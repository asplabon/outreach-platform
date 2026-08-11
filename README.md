# AI Email Outreach & Automation Platform

A production-ready SaaS app for cold-email outreach: connect a Google account +
Google Sheet as your lead source, build multi-step campaigns, send personalized
emails through your Gmail via a background queue, detect replies, classify them
with AI, generate human-approved reply drafts, sync statuses back to the sheet,
and track everything on an analytics dashboard.

> **Status:** Phase 2 complete — Google OAuth mailbox connection (encrypted
> token storage, auto-refresh), Google Sheets import (spreadsheet → column
> mapping → dedupe-aware lead import), and a Sheet status-sync worker. Later
> phases (campaigns, sending, replies, AI, analytics) land incrementally; see
> [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
Prisma + PostgreSQL (SQLite for local dev) · Redis + BullMQ (in-process
fallback) · NextAuth.js (Google sign-in) · Gmail API · Google Sheets API ·
OpenAI (behind an `AIProvider` abstraction) · Zod · React Hook Form · Recharts
· TanStack Table · Vitest.

## Quick start (zero-setup local dev)

Requires **Node 20+** (built and verified on Node 26).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   - Set NEXTAUTH_SECRET and ENCRYPTION_KEY (see .env.example for generators)
#   - Optional: AUTH_ALLOW_DEV_LOGIN=true + DEV_LOGIN_EMAIL=you@example.com
#     to test sign-in before Google Cloud setup (dev-only; never in production)

# 3. Create the local SQLite database from the Prisma schema
npm run db:push

# 4. Start the app
npm run dev
```

Open http://localhost:3000 → sign in (Google or dev-login) → dashboard shell.

### Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` (SQLite) |
| `REDIS_URL` | Redis for BullMQ; empty = in-process queue | empty |
| `QUEUE_MODE` | `auto` \| `redis` \| `in_process` | `auto` |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Session signing secret | — (required) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | App sign-in OAuth | empty (dev-login) |
| `GOOGLE_REDIRECT_URI` | Mailbox OAuth callback | `http://localhost:3000/api/google/callback` |
| `AI_PROVIDER` | `demo` \| `openai` | `demo` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Real AI provider | empty / `gpt-4o-mini` |
| `ENCRYPTION_KEY` | AES-256-GCM master key (32-byte hex) | — (required) |
| `AUTH_ALLOW_DEV_LOGIN` / `DEV_LOGIN_EMAIL` | Dev-only login gate | `false` / empty |
| `EMAIL_DEFAULT_DAILY_LIMIT` | Per-campaign daily send cap | `50` |
| `REPLY_SYNC_INTERVAL_MINUTES` | Reply detection cadence | `5` |

Full reference in [`.env.example`](.env.example).

## Production stack (PostgreSQL + Redis + BullMQ workers)

```bash
# Start PostgreSQL + Redis
docker compose up -d

# Point at Postgres: edit .env DATABASE_URL and switch the Prisma datasource
# provider to "postgresql" (see ARCHITECTURE.md / .env.example), then:
npm run db:generate
npm run db:push

# Run the web app
npm run build && npm start

# Run background workers (separate process)
npm run worker          # all queues
npm run worker:email    # or individual queues
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit tests) |
| `npm run db:push` | Sync Prisma schema to DB |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Seed data |
| `npm run worker*` | Boot queue workers |

## Documentation

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — phased roadmap and acceptance criteria
- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, data flow, security model
- [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) — Google Cloud / OAuth setup
