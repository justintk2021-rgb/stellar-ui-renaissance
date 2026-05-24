# NSYNC Journal — Cursor Migration Guide

> Migrated from Lovable.dev to local development. This document is your single source of truth for understanding the codebase and getting it running independently.

---

## Codebase Overview

**NSYNC Journal** is a personal forex/crypto/stock trading journal built as a Vite + React + TypeScript SPA, backed by Supabase (Postgres, Auth, Realtime, Edge Functions).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui, Framer Motion |
| State / Data | TanStack Query v5, React Hook Form, Zod |
| Routing | React Router v6 |
| Backend | Supabase (Auth, Postgres, Realtime) |
| Edge Functions | Deno (deployed to Supabase) |
| Charts | Recharts, lightweight-charts, TradingView widget |
| 3D | React Three Fiber / Drei |

### Directory Structure

```
stellar-ui-renaissance/
├── index.html                    # HTML shell — loads /src/main.tsx
├── vite.config.ts                # Vite config (React SWC, @/* alias, port 8080)
├── tailwind.config.ts            # Theme: custom fonts, shadcn CSS vars, animations
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── components.json               # shadcn/ui config
├── .env                          # Supabase public keys (safe to commit — anon key)
├── .env.example                  # Template for env vars
│
├── src/
│   ├── main.tsx                  # React root mount
│   ├── App.tsx                   # Providers + React Router routes
│   ├── index.css                 # Global styles, Tailwind directives, CSS vars
│   │
│   ├── pages/
│   │   ├── Landing.tsx           # Public landing page (route: /)
│   │   ├── Auth.tsx              # Login / signup (route: /auth)
│   │   ├── Index.tsx             # Main dashboard — all tabs (route: /dashboard)
│   │   ├── ResetPassword.tsx     # Password reset (route: /reset-password)
│   │   └── NotFound.tsx          # 404 fallback
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (accordion, button, dialog…)
│   │   ├── Layout/               # Sidebar, TopBar, MobileNav, PageTransition, AnimatedBackground
│   │   ├── Dashboard/            # BalanceCards, EquityChart, PnLCalendar, StatsGrid, RankCard…
│   │   ├── Journal/              # TradeTable, TradeFormModal, CompareView, ChecklistPopup…
│   │   ├── AI/                   # TradingAssistant.tsx — chat UI for AI edge function
│   │   ├── Chart/                # CustomChart, LightweightChart wrappers
│   │   ├── Settings/             # SettingsView, CSVImport, BrokerManagement, MyfxbookPanel
│   │   ├── Playbook/             # PlaybookView, PlaybookDetailView
│   │   ├── Notebook/             # NotebookView (rich notes)
│   │   ├── Community/            # CommunityView (real-time chat channels)
│   │   ├── Calculator/           # LotSizeCalculator
│   │   └── EconomicCalendar/     # EconomicCalendarView
│   │
│   ├── hooks/
│   │   ├── useTrades.ts          # CRUD for trades table
│   │   ├── useUserSettings.ts    # User preferences (Supabase)
│   │   ├── useApplyGlobalSettings.ts  # Applies theme/font settings on mount
│   │   ├── useTradingAccounts.ts # Multi-account support
│   │   ├── useChecklists.ts      # Pre-trade checklists
│   │   ├── useNotebookEntries.ts # Notebook CRUD
│   │   ├── useTradeLocker.ts     # TradeLocker broker sync
│   │   ├── useMyfxbook.ts        # Myfxbook import
│   │   ├── useLocalStorage.ts    # Generic localStorage hook
│   │   ├── useCountUp.ts         # Animated number counter
│   │   ├── useThemeTransition.ts # Smooth theme switching
│   │   └── use-mobile.tsx        # Responsive breakpoint detection
│   │
│   ├── lib/
│   │   ├── utils.ts              # cn(), truncateNum()
│   │   ├── tradeFormat.ts        # Date key helpers, sumPnL, formatPnL
│   │   └── compareMetrics.ts     # Period comparison analytics engine
│   │
│   ├── types/
│   │   └── trade.ts              # Trade TypeScript types
│   │
│   └── integrations/
│       └── supabase/
│           ├── client.ts         # Supabase client (reads from VITE_SUPABASE_* env)
│           └── types.ts          # Auto-generated DB types (do not edit manually)
│
├── supabase/
│   ├── config.toml               # Local Supabase CLI config + function JWT settings
│   ├── migrations/               # 31 SQL migration files (full schema history)
│   └── functions/
│       ├── trading-assistant/    # AI chat (OpenAI gpt-4o-mini, tool calls)
│       ├── economic-calendar/    # External economic data proxy
│       ├── myfxbook/             # Myfxbook API proxy
│       ├── tradelocker/          # TradeLocker broker API proxy
│       ├── voice-to-text/        # OpenAI Whisper STT
│       └── text-to-voice/        # OpenAI TTS
│
└── public/
    └── robots.txt
```

### Database Tables (Supabase Postgres)

| Table | Purpose |
|-------|---------|
| `trades` | Core trade records (pair, direction, P&L, session, strategy…) |
| `trading_accounts` | Named accounts per user |
| `user_settings` | Theme, font, display preferences |
| `profiles` | User profile data |
| `checklists` | Pre-trade checklist templates + entries |
| `notebook_entries` | Free-form journal notes |
| `broker_accounts` / `broker_connections` | Broker sync config |
| `broker_trades` / `broker_orders` / `broker_positions` | Synced broker data |
| `broker_sync_logs` | Sync audit trail |
| `community_channels` / `community_messages` / `community_reactions` | Real-time community |
| `direct_messages` | DMs between users |

### App Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Landing.tsx` | Public marketing/landing page |
| `/auth` | `Auth.tsx` | Supabase email auth (login + signup) |
| `/dashboard` | `Index.tsx` | Protected main app (tabs: Dashboard, Journal, AI, Playbook, Notebook, Community, Calculator, Calendar, Settings) |
| `/reset-password` | `ResetPassword.tsx` | Password reset flow |
| `*` | `NotFound.tsx` | 404 |

---

## Disconnecting from Lovable — What Was Done

The following changes have **already been applied** to this codebase:

### 1. Removed `lovable-tagger` dev plugin

**`package.json`** — `lovable-tagger` removed from `devDependencies`.

**`vite.config.ts`** — `componentTagger()` import and usage removed. The config is now a clean static `defineConfig({...})`.

### 2. Replaced Lovable AI Gateway in edge function

**`supabase/functions/trading-assistant/index.ts`** — The function previously called `https://ai.gateway.lovable.dev/v1/chat/completions` with a `LOVABLE_API_KEY` secret and `google/gemini-2.5-flash` model.

It now calls **OpenAI's API** (`https://api.openai.com/v1/chat/completions`) using the existing `OPENAI_API_KEY` secret with model `gpt-4o-mini`. The request/response shape is identical (OpenAI-compatible), so no other code changes were needed.

### 3. Nothing else depends on Lovable

- The `README.md` still contains Lovable onboarding text — you can overwrite it freely.
- No runtime code (components, hooks, pages) ever imported from `lovable-tagger` directly.
- Supabase itself is **not** a Lovable dependency — it is a standalone service you own.

---

## Local Development Setup

Follow these steps in order.

### Prerequisites

Make sure you have the following installed:

- **Node.js** v20+ — [nodejs.org](https://nodejs.org)
- **npm** v10+ (comes with Node) or **Bun** — [bun.sh](https://bun.sh) *(both lockfiles are present)*
- **Supabase CLI** (for running edge functions and managing migrations) — [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
  ```powershell
  # Windows (via Scoop)
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  
  # Or via npm (any platform)
  npm install -g supabase
  ```
- **Docker Desktop** — required by the Supabase CLI to run a local Postgres instance. [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

---

### Step 1 — Clone and install dependencies

```powershell
# If you haven't already, clone the repo
git clone <your-repo-url>
cd stellar-ui-renaissance

# Install frontend dependencies
npm install

# Verify lovable-tagger is gone
npm ls lovable-tagger   # should show "(empty)"
```

---

### Step 2 — Configure environment variables

Copy the example file and fill in your values:

```powershell
copy .env.example .env
```

Open `.env` and set:

```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
```

Find these values at: **Supabase Dashboard → Your Project → Settings → API**

> The `.env` file that ships with this repo already has the original project's keys filled in. If you are continuing to use that same Supabase project, you don't need to change anything here.

---

### Step 3 — Start the frontend dev server

```powershell
npm run dev
```

The app will be available at **http://localhost:8080**

At this point the full UI will load and auth will work if the `.env` points to a live Supabase project. This is enough for most frontend development work.

---

### Step 4 — (Optional) Run Supabase locally with the CLI

If you want a fully local backend (no cloud dependency), use the Supabase CLI:

```powershell
# Start local Supabase (requires Docker Desktop running)
supabase start
```

This will spin up a local Postgres + GoTrue + Storage + Edge Runtime. After it starts, it will print local credentials:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
```

Update your `.env` with the local values:

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="<local anon key>"
```

Then apply all migrations to seed the local DB:

```powershell
supabase db push
# or, to reset and replay all migrations from scratch:
supabase db reset
```

---

### Step 5 — (Optional) Deploy or serve edge functions

#### Serve locally

```powershell
supabase functions serve
```

This starts a local Deno edge runtime at `http://localhost:54321/functions/v1/`.

You must also set edge function secrets locally. Create a `.env.local` in the `supabase/functions/` folder (not committed) or use the CLI:

```powershell
# Required for AI assistant
supabase secrets set OPENAI_API_KEY=sk-...

# Required for voice features
supabase secrets set OPENAI_API_KEY=sk-...

# Required for TradeLocker integration (if using)
# supabase secrets set TRADELOCKER_... 
```

#### Deploy to your cloud Supabase project

```powershell
# Deploy all functions
supabase functions deploy

# Deploy a single function
supabase functions deploy trading-assistant

# Set secrets on the cloud project
supabase secrets set --env-file ./supabase/.env.production
```

---

### Step 6 — Build for production

```powershell
npm run build
```

Output goes to `dist/`. Preview the production build locally:

```powershell
npm run preview
```

---

## Edge Function Secrets Reference

These secrets must be set in your Supabase project (Dashboard → Edge Functions → Secrets, or via CLI):

| Secret | Used By | Where to Get It |
|--------|---------|----------------|
| `OPENAI_API_KEY` | `trading-assistant`, `voice-to-text`, `text-to-voice` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SUPABASE_URL` | All functions (auto-injected) | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | All functions (auto-injected) | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions needing admin DB access | Supabase Dashboard → Settings → API |

> `LOVABLE_API_KEY` is **no longer needed** — it has been replaced by `OPENAI_API_KEY` in the `trading-assistant` function.

---

## Common Commands

```powershell
npm run dev          # Start frontend dev server (http://localhost:8080)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # Run ESLint

supabase start       # Start local Supabase stack (Docker required)
supabase stop        # Stop local Supabase stack
supabase db reset    # Wipe and replay all migrations locally
supabase db push     # Apply pending migrations to local DB
supabase functions serve              # Serve edge functions locally
supabase functions deploy             # Deploy all edge functions to cloud
supabase secrets set KEY=value        # Set a cloud edge function secret
```

---

## Notes & Known Considerations

- **`src/integrations/supabase/types.ts`** is auto-generated by Lovable/Supabase introspection. If you modify the database schema, regenerate it with:
  ```powershell
  supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
  ```

- **Community features** use Supabase Realtime subscriptions — these work the same locally and in cloud.

- **TradingView chart widget** (`components/Dashboard/TradingViewChart.tsx`) loads TradingView's external script at runtime. It requires internet access and will not work fully offline.

- **Economic Calendar** (`supabase/functions/economic-calendar/`) proxies an external data source — check that function's code if the calendar stops loading.

- **Myfxbook / TradeLocker** broker integrations require valid API credentials from those respective services, set as Supabase edge function secrets.

- Both `package-lock.json` (npm) and `bun.lock` (Bun) are present. Use whichever package manager you prefer — just stay consistent. `npm install` is safest if you're unsure.
