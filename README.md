# NSYNC Journal

Personal trading journal for forex, crypto, and stocks. It is a Vite + React 18 + TypeScript app (originally scaffolded with Lovable) backed by Supabase and deployed on Vercel.

Live site: https://stellar-ui-renaissance.vercel.app

## Stack

- React 18, TypeScript, Vite 5
- Tailwind CSS and shadcn/ui
- TanStack Query, React Router (`/dashboard` hosts the signed-in app)
- Supabase Auth, Postgres, Realtime, and Edge Functions
- TradeLocker sync and a local MetaTrader 5 bridge

## Setup

Requirements: Node.js 20+ and npm.

```sh
git clone <your-repo-url>
cd stellar-ui-renaissance
npm install
cp .env.example .env
npm run dev
```

The dev server runs at http://localhost:8080.

Production installs use **npm** and `package-lock.json`. Vercel selects npm when that lockfile is present. Do not add a second lockfile.

## Environment variables

Copy `.env.example` to `.env`. Vite only exposes variables prefixed with `VITE_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Project URL, `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon / publishable key |
| `VITE_SUPABASE_PROJECT_ID` | No | Project ref, kept for tooling |

Find them in the Supabase dashboard under **Project Settings → API**. Set the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values in the Vercel project for Production and Preview.

The app stays up without these, but auth and data calls will fail until they are set.

## Scripts

```sh
npm run dev        # Vite dev server
npm run build      # Production build to dist/
npm run preview    # Preview the production build
npm run typecheck  # tsc --noEmit
npm run test       # Unit tests (vitest)
npm run lint       # ESLint
```

## Supabase

Schema lives in `supabase/migrations`. Generated database types are in `src/integrations/supabase/types.ts`.

Edge functions in `supabase/functions`:

| Function | Role |
| --- | --- |
| `tradelocker` | TradeLocker auth, session refresh, account sync, journal import, and Chart candles/quotes |
| `tradelocker-market` | Optional Chart-only proxy (the Chart page uses `tradelocker` first) |
| `mt5-bridge` | Pairs the local MT5 bridge and stores imported history |
| `myfxbook` | Myfxbook account import |
| `trading-assistant` | Journal assistant (OpenAI, `OPENAI_API_KEY`) |
| `voice-to-text` / `text-to-voice` | Speech features (OpenAI) |
| `economic-calendar` | Economic calendar proxy |
| `chart-datafeed` | Chart data proxy |

Serve them locally with the Supabase CLI (`supabase functions serve`) after `supabase start`. Deploy with `supabase functions deploy`. Frontend deploys on Vercel do **not** deploy these functions.

Function secrets (set in the Supabase dashboard or with `supabase secrets set`):

- `OPENAI_API_KEY` for the assistant and voice functions
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase

## MetaTrader 5 bridge

The Windows bridge in `bridges/mt5` runs beside a local MetaTrader 5 terminal. It logs in with credentials saved in the app, then posts account and history snapshots to the `mt5-bridge` edge function. It imports data only; it does not place trades.

See `bridges/mt5/README.md` for `setup.ps1`, `run.ps1`, and the bridge `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MT5_BRIDGE_KEY`).

## Trade P&L

Net P&L and win rate come from `src/lib/tradePnl.ts`. UI code should call `getTradeNetResult` / `journalTradeStats` in `src/lib/tradeFormat.ts` (those include the broker position cache) instead of summing `trade.result` directly.

Imported TradeLocker and MT5 rows use the broker's realized P&L and do not add swap/commission a second time. Manual rows add non-zero swap and commission once. Duplicate imports that share a broker position id count once.
