# Project Plan — AI Email Outreach & Automation Platform

A production-ready SaaS web app for cold email outreach that automates the
whole loop: import leads from Google Sheets → run multi-step personalized
campaigns through Gmail → detect replies → classify them with AI → generate
reviewable reply drafts → sync statuses back to the sheet → report on
everything in an analytics dashboard.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript (strict) + React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui (base-nova) + Lucide icons |
| Database | PostgreSQL via Prisma (SQLite for zero-setup local dev) |
| Queue | Redis + BullMQ (in-process FIFO fallback for local dev) |
| App sign-in | NextAuth.js (Auth.js) v5 — Google OAuth |
| Mailbox/Sheets auth | Custom googleapis OAuth flow (separate from app sign-in) |
| Integrations | Gmail API, Google Sheets API, OpenAI API (behind `AIProvider`) |
| Validation | Zod |
| Forms | React Hook Form |
| Charts / tables | Recharts, TanStack Table |
| Tests | Vitest |

## Build phases

Each phase ends with: tests pass, `typecheck` + `lint` + `build` clean, manual
verification, README update, and a report of what was implemented, files
changed, DB changes, env vars, tests performed, and remaining work.

### Phase 1 — Architecture, DB, Auth, Shell ✅ *in progress*
- Next.js scaffold, shadcn/ui, Tailwind v4.
- Full Prisma schema (users, google_connections, mailboxes, spreadsheets,
  sheet_mappings, leads, campaigns, campaign_leads, email_templates,
  sequences, sequence_steps, messages, message_events, replies, ai_runs,
  ai_replies, suppressions, activity_logs, notifications).
- Docker Compose (PostgreSQL + Redis) for the production-ish stack.
- Auth: NextAuth Google sign-in + gated dev-login fallback; AES-256-GCM token
  crypto; Zod env validation.
- Queue infra: BullMQ + in-process fallback, worker runner.
- Dashboard shell: sidebar (10 sections), topbar, home page with real KPIs,
  placeholder pages for sections that ship in later phases, settings page.

### Phase 2 — Google OAuth + Sheets
- Connect a mailbox: custom OAuth with Gmail + Sheets scopes; encrypted token
  storage; automatic refresh / expiry handling.
- Spreadsheet selection, header read, column→field mapping, lead preview, import.
- Sheet status sync worker (writes campaign status back to the sheet).

### Phase 3 — Leads, Campaigns, Templates
- Leads: search/filter/sort/pagination, tags, custom fields, detail view.
- Campaign builder (lead source, mailbox, sequence, template, pacing).
- Template editor with `{{variables}}`, live preview, validation.

### Phase 4 — Gmail sending ✅
- BullMQ email queue + sending worker → Gmail API (`email:send-initial`).
- Idempotency keys (message idempotencyKey + deterministic job ids), pacing /
  daily limits / working hours / timezone (lib/email/schedule).
- Retry + exponential backoff (BullMQ), message + message_events records,
  campaign launch / pause / resume (API + UI).

### Phase 5 — Follow-ups + reply detection ✅
- Sequence CRUD (lib, API routes, list/new/edit pages + step editor) and
  campaign-form sequence select + validation.
- Follow-up engine: `email:send-followup` (in-thread via threadId, Re: subject,
  idempotency key, next-step scheduling / completion) + `email:process-followups`
  due dispatcher; `computeNextActionAt` (lib/email/schedule).
- Reply-sync worker (`reply:sync-replies`): Gmail thread matching,
  auto-reply / bounce / unsubscribe heuristics (lib/replies/extract — pure),
  dedupe on gmailMessageId, stop-on-reply, bounce + unsubscribe suppression,
  sheet-sync enqueue.
- Scheduling: BullMQ repeatable jobs (workers/boot.ts) in Redis mode; dev
  interval in-process; manual `POST /api/replies/sync`.

### Phase 6 — AI ✅
- `AIProvider` interface (classifyReply / generateReply) with `OpenAIProvider`
  (lazy-loaded openai SDK, JSON response_format, Zod re-validation) and a
  clearly-labeled `DemoProvider` (deterministic keyword heuristics, zero-network)
  selected by `AI_PROVIDER=demo|openai`.
- Classification pipeline (`ai:process-pending` + `ai:process-reply`):
  `Reply` → Zod-validated intent/confidence/summary/escalation, recorded in
  `ai_runs` (CLASSIFY_REPLY + GENERATE_REPLY), lead `aiIntent` updated.
- Draft generation + routing: `decideSendRoute` (pure) — Approval mode → review;
  Controlled Auto-Reply sends only when intent is allow-listed, confidence ≥
  0.7, and nothing blocks it; unsubscribe / not-interested / model-flagged
  always ESCALATE to a human and never auto-send.
- AI Replies review page (`/ai-replies`) with intent/confidence/status badges,
  original reply + draft preview, Approve (send in-thread) and Reject actions
  (`POST /api/ai-replies/[id]/approve` / `reject`).

### Phase 7 — Analytics
- Dashboard KPIs + charts, campaign funnel, activity feed, notifications,
  exportable reports.

### Phase 8 — Security / hardening / production
- Rate limiting, audit log, error-handling polish, integration tests,
  production deployment prep.

## Acceptance criteria (spec §38)

End-to-end workflow: Google sign-in → connect mailbox → connect sheet → import
leads → build campaign → queued personalized sends → reply detected → AI
classified → human-approved reply → sheet status sync → analytics — exercised
against real providers (or clearly-labeled demo where credentials are absent).

## Environment variables

See [`.env.example`](.env.example). Never commit real values.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design and data flow
- [README.md](README.md) — clean-machine setup
- [GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md) — Google Cloud configuration
