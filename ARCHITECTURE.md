# Architecture — AI Email Outreach & Automation Platform

## System overview

A single Next.js 15 app serves the dashboard and API routes; background work
(email sending, reply detection, sheet sync, AI) runs on BullMQ workers
consuming Redis queues. Local development can run every job in-process with no
Redis — the same `enqueue()` call is used either way.

```
┌──────────────────────────── Next.js app (single process) ─────────────────────────────┐
│  Browser ──► App Router pages ──► server components / route handlers                    │
│  (dashboard)       │                  │                                                │
│                    ▼                  ▼                                                │
│             Prisma  ───────►  PostgreSQL  (SQLite for local dev)                        │
│             enqueue() ───────►  Queue abstraction                                      │
└────────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │ in-process (dev) │ Redis + BullMQ (prod)
                                     ▼                  ▼
                              job handlers      workers/* (email, reply, sheets, ai)
                                                                  │
                                                                  ▼
                                                   Gmail API · Sheets API · OpenAI
```

## Two separate Google authorizations

Per the spec, application auth and mailbox authorization are distinct flows:

1. **App sign-in** — NextAuth v5 `GoogleProvider` (scopes `openid email
   profile`). Gated on `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. A dev-only
   credentials provider (`AUTH_ALLOW_DEV_LOGIN` + `DEV_LOGIN_EMAIL`) lets you
   test locally before Google Cloud setup; it is strictly gated and never
   enabled in production.
2. **Mailbox authorization** — a custom OAuth flow (`lib/google`, Phase 2)
   requesting Gmail + Sheets scopes. Refresh + access tokens are stored
   **AES-256-GCM encrypted** (`lib/security/crypto.ts`, master key from
   `ENCRYPTION_KEY`) and never sent to the browser. Access tokens are refreshed
   automatically on expiry.

## Queue design

- `lib/queue/` defines queue names, `enqueue()`, and the processor registry.
- **Redis mode** (`REDIS_URL` set, `QUEUE_MODE=auto|redis`): `enqueue()` adds a
  BullMQ job; separate worker processes (`workers/*`) consume it.
- **In-process mode** (`QUEUE_MODE=in_process`, or `auto` with no `REDIS_URL`):
  `enqueue()` runs the registered handler inline (honoring `delayMs` via a
  timer). Used for zero-setup development.
- Queue-level **idempotency**: a deterministic `jobId` prevents duplicate
  jobs. Message-level idempotency is enforced by a unique `idempotencyKey` on
  the `messages` table.
- Workers only boot for queues that have registered processors — a queue is
  never silently consuming jobs with no handler.

## AI abstraction

`AIProvider` (Phase 6) defines the contract — `classifyReply`,
`generateReply`, `generateSubject`, `analyzeLead`. Implementations:

- `OpenAIProvider` — real integration via the `openai` SDK (OpenAI-compatible
  endpoint), selected by `AI_PROVIDER=openai` + `OPENAI_API_KEY`.
- `DemoProvider` — deterministic, zero-network, clearly labeled, dev-only,
  selected by `AI_PROVIDER=demo` (the default until a key is provided).

Classification output is validated against a Zod schema before it is trusted.

## Data flow — one campaign send

1. Campaign scheduled → leads assigned → `messages` rows created (`QUEUED`)
   with a stable `idempotencyKey`.
2. `enqueue("email", "send", { messageId })` → worker renders the template with
   lead fields, applies pacing (daily limit, working hours, timezone, random
   delay), sends via Gmail API, records `gmailMessageId` / `gmailThreadId` and a
   `message_events` row.
3. On failure: retry with exponential backoff up to `attempts`; permanent
   failure marks the message `FAILED` and the campaign lead accordingly.

## Reply detection & AI

1. A periodic reply-sync worker (or the reply queue) pulls Gmail messages,
   matches threads to sent messages, stores `replies`.
2. `enqueue("ai", "classify-reply", { replyId })` → `AIProvider.classifyReply`
   → Zod-validated `{ intent, confidence }` → stored on the reply + lead.
3. `enqueue("ai", "generate-reply", { replyId })` → draft stored as an
   `ai_replies` row, `PENDING_REVIEW` → Approval mode or Controlled Auto-Reply.
4. Approved replies are sent via the email queue; statuses sync back to the
   source spreadsheet.

## Security

- Tokens encrypted at rest (AES-256-GCM); refresh tokens never reach the browser.
- All queries scoped to `userId`; server-side authorization on every route.
- Zod validation on env and every untrusted input; no hardcoded secrets.
- Idempotency keys prevent duplicate sends; pacing prevents Gmail rate limits.
- Unsubscribe / suppression always honored; AI never auto-replies to
  unsubscribes, sensitive topics, or low-confidence classifications.

## Directory map

```
src/
  app/            App Router: (auth) sign-in, (dashboard) app, api/ route handlers
  auth.ts         NextAuth v5 config
  components/     dashboard shell, ui/ (shadcn), feature components
  lib/
    auth/         session helpers
    db.ts         Prisma client singleton
    env.ts        Zod-validated environment
    queue/        queue abstraction, connection, processor registry
    security/     AES-256-GCM crypto
    format.ts     date formatting
workers/          BullMQ worker entry scripts (tsx)
prisma/
  schema.prisma   full data model
  seed.ts         optional seed data
```
