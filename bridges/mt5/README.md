# MT5 Local Bridge

This bridge runs on the same Windows machine or VPS as MetaTrader 5. The user enters their MT5 broker login on the website, then this bridge fetches those credentials with the pairing key, logs into MT5, and syncs account data and trade history to Supabase.

## Setup

1. Install MetaTrader 5.
2. Install Python 3.10+ for Windows.
3. In the app, open Settings -> Broker Management -> MetaTrader 5 and enter the user's MT5 login, password, and server.
4. Copy the bridge key shown by the app.
5. Run `setup.ps1`.
6. Edit `.env` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `MT5_BRIDGE_KEY`
7. Run `run.ps1`.

## Notes

- MT5 must stay installed on the same machine as this bridge.
- The MT5 password is entered on the website, encrypted by the Edge Function, and fetched by the paired local bridge.
- The bridge only imports/syncs data. It does not execute trades.
