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

### Phase 5 — Follow-ups + reply detection
- Multi-step sequences with delays; stop-on-reply / suppress / bounce rules.
- Reply-sync worker (Gmail thread matching), duplicate-reply prevention.

### Phase 6 — AI
- Classify replies → structured JSON validated with Zod.
- Generate reply drafts. Approval mode + Controlled Auto-Reply with strict
  escalation rules (never auto-reply to unsubscribes / sensitive / low
  confidence). AI Replies review page.

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
