# AI Email Outreach & Automation Platform

A production-ready SaaS application for cold-email outreach at scale. Connect your Google account and Google Sheets as a lead source, build multi-step campaigns, send personalized emails through your Gmail via a background queue, detect and classify replies with AI, generate human-approved reply drafts, sync statuses back to your spreadsheet, and track everything on an analytics dashboard.

> **Status:** Phase 7 complete — analytics now make the whole loop visible. The **Dashboard** shows KPI cards, a 14-day send-vs-reply area chart (Recharts), a recent-activity feed, and your latest campaigns. The **Analytics** page adds reply rate / bounce rate / pending AI / active campaigns, the same trend chart, a per-campaign funnel (total → sent → replied → interested), and a one-click CSV export. The **Activity** page renders the event feed (activity_logs) plus a notifications panel with unread counts and mark-all read; notifications are now written for AI escalations (`REPLY_NEEDS_REVIEW`) and campaign completion (`CAMPAIGN_COMPLETED`). Phase 8 covers hardening; see [PROJECT_PLAN.md](PROJECT_PLAN.md).

---

## ✨ Features

### 🎯 Lead Management
- **Google Sheets Integration** — Import leads directly from Google Sheets with column mapping
- **Lead Profiles** — Track email, name, company, custom fields, and engagement status
- **Bulk Operations** — Add, edit, and manage leads at scale

### 📧 Campaign Builder
- **Multi-step Sequences** — Create drip campaigns with delays, conditions, and branching
- **Template System** — Reusable email templates with variable substitution (`{{firstName}}`, `{{company}}`, etc.)
- **A/B Testing** — Test subject lines and body copy variants
- **Scheduling** — Set send windows, timezone-aware delivery, and daily limits

### 🤖 AI-Powered Replies
- **Automatic Reply Detection** — Background workers poll Gmail for new replies
- **AI Classification** — Categorize replies: `INTERESTED`, `NOT_INTERESTED`, `UNSUBSCRIBE`, `OUT_OF_OFFICE`, `NEEDS_REVIEW`
- **Draft Generation** — AI writes contextual reply drafts for human review
- **Approval Workflow** — Approve, edit, or reject AI drafts before sending

### 📊 Analytics & Reporting
- **Dashboard KPIs** — Total sent, replied, interested, bounce rate, pending AI reviews
- **Trend Charts** — 14-day send vs. reply area chart (Recharts)
- **Campaign Funnels** — Per-campaign funnel: total → sent → replied → interested
- **CSV Export** — One-click export of campaign analytics
- **Activity Feed** — Real-time event log with notifications panel

### 🔐 Security & Compliance
- **Google OAuth 2.0** — Secure sign-in and mailbox authorization (separate scopes)
- **Encrypted Token Storage** — AES-256-GCM encryption for OAuth refresh tokens
- **Role-Based Access** — User roles with Prisma-backed authorization
- **Rate Limiting** — Built-in API rate limiting and daily send caps

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Database** | Prisma ORM + PostgreSQL (SQLite for local dev) |
| **Queue** | Redis + BullMQ (in-process fallback for dev) |
| **Auth** | NextAuth.js (Google OAuth) |
| **APIs** | Gmail API, Google Sheets API |
| **AI** | OpenAI (via `AIProvider` abstraction; demo mode available) |
| **Validation** | Zod |
| **Forms** | React Hook Form |
| **Charts** | Recharts |
| **Tables** | TanStack Table |
| **Testing** | Vitest |

---

## 🚀 Quick Start (Zero-Setup Local Dev)

> Requires **Node 20+** (built and verified on Node 26).

```bash
# 1. Clone the repository
git clone https://github.com/asplabon/outreach-platform.git
cd outreach-platform

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
#   - Set NEXTAUTH_SECRET and ENCRYPTION_KEY (see .env.example for generators)
#   - Optional: AUTH_ALLOW_DEV_LOGIN=true + DEV_LOGIN_EMAIL=you@example.com
#     to test sign-in before Google Cloud setup (dev-only; never in production)

# 4. Create the local SQLite database from the Prisma schema
npm run db:push

# 5. Start the app
npm run dev
```

Open **http://localhost:3000** (or 3001 if 3000 is in use) → sign in (Google or dev-login) → dashboard shell.

---

## ⚙️ Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` (SQLite) | Yes |
| `REDIS_URL` | Redis for BullMQ; empty = in-process queue | empty | No |
| `QUEUE_MODE` | `auto` \| `redis` \| `in_process` | `auto` | No |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` | Yes |
| `NEXTAUTH_SECRET` | Session signing secret (32+ chars) | — | **Yes** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | App sign-in OAuth | empty (dev-login) | Prod only |
| `GOOGLE_REDIRECT_URI` | Mailbox OAuth callback | `http://localhost:3000/api/google/callback` | Yes |
| `AI_PROVIDER` | `demo` \| `openai` | `demo` | No |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Real AI provider | empty / `gpt-4o-mini` | If OpenAI |
| `ENCRYPTION_KEY` | AES-256-GCM master key (32-byte hex) | — | **Yes** |
| `AUTH_ALLOW_DEV_LOGIN` / `DEV_LOGIN_EMAIL` | Dev-only login gate | `false` / empty | Dev only |
| `EMAIL_DEFAULT_DAILY_LIMIT` | Per-campaign daily send cap | `50` | No |
| `REPLY_SYNC_INTERVAL_MINUTES` | Reply detection cadence | `5` | No |

**Generate secrets:**
```bash
# NEXTAUTH_SECRET
npx auth secret
# or: node -e "console.log(crypto.randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Full reference in [`.env.example`](.env.example).

---

## 🏭 Production Deployment

### PostgreSQL + Redis + BullMQ Workers (Docker Compose)

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Point at PostgreSQL
# Edit .env: DATABASE_URL="postgresql://outreach:outreach@localhost:5432/outreach"
# Switch Prisma datasource provider to "postgresql" (see ARCHITECTURE.md / .env.example)

# 3. Generate Prisma client & push schema
npm run db:generate
npm run db:push

# 4. Build and run web app
npm run build && npm start

# 5. Run background workers (separate process)
npm run worker          # all queues
npm run worker:email    # or individual queues
npm run worker:ai
npm run worker:reply
npm run worker:sheet-sync
```

### Environment-Specific Notes
- **NEXTAUTH_URL** must match your production domain exactly
- **GOOGLE_REDIRECT_URI** must be added to your Google Cloud OAuth client
- Set `AUTH_ALLOW_DEV_LOGIN="false"` in production
- Use a managed PostgreSQL (Neon, Supabase, RDS) and Redis (Upstash, Redis Cloud) for production

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Auth layout group (signin page)
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── activity/       # Activity feed & notifications
│   │   ├── ai-replies/     # AI reply review queue
│   │   ├── analytics/      # Analytics dashboard & CSV export
│   │   ├── campaigns/      # Campaign CRUD + launch
│   │   ├── leads/          # Lead management
│   │   ├── mailboxes/      # Google mailbox connections
│   │   ├── sequences/      # Multi-step sequence builder
│   │   ├── settings/       # User/org settings
│   │   ├── sheets/         # Google Sheets import
│   │   └── templates/      # Email template library
│   └── api/                # API routes (REST + NextAuth)
├── auth.ts                 # NextAuth v5 configuration
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── dashboard/          # Layout, sidebar, header
│   ├── analytics/          # Charts, KPI cards, funnels
│   └── ...                 # Feature-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Core business logic
│   ├── ai/                 # AI provider abstraction + classification
│   ├── analytics/          # Analytics aggregation
│   ├── auth/               # Session helpers
│   ├── campaigns/          # Campaign orchestration
│   ├── db.ts               # Prisma client
│   ├── email/              # Rendering, scheduling, sending
│   ├── env.ts              # Zod-validated env schema
│   ├── google/             # Gmail + Sheets API clients
│   ├── leads/              # Import, mapping, CRUD
│   ├── queue/              # BullMQ setup + processors
│   ├── replies/            # Reply extraction + sync
│   ├── security/           # AES-256-GCM crypto
│   ├── sequences/          # Sequence engine
│   └── templates/          # Template variable resolution
├── types/                  # TypeScript type extensions
└── workers/                # Background worker entry points
```

---

## 📖 Documentation

- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** — Phased roadmap, acceptance criteria, and Phase 8 hardening checklist
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design, data flow, security model, queue topology
- **[GOOGLE_CLOUD_SETUP.md](GOOGLE_CLOUD_SETUP.md)** — Step-by-step Google Cloud project, APIs, OAuth consent, credentials

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [NextAuth.js](https://next-auth.js.org/) for authentication
- [shadcn/ui](https://ui.shadcn.com/) for beautiful, accessible components
- [Prisma](https://www.prisma.io/) for type-safe database access
- [BullMQ](https://bullmq.io/) for robust queue processing
- [Recharts](https://recharts.org/) for declarative charting