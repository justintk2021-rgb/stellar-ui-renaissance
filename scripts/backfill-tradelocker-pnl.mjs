/**
 * Recompute TradeLocker journal P/L from stored open/close order payloads
 * (fixes double-counting open + close legs). Run after deploying tradelocker function.
 *
 * Usage: node scripts/backfill-tradelocker-pnl.mjs
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env or .env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]+)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function firstFinite(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = Number(obj[k]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function extractBrokerNetPl(openOrder, closeOrder, fallbackGross, orderSwap, orderCommission) {
  const primary = closeOrder || openOrder;
  if (!primary) return fallbackGross + orderSwap + orderCommission;

  const net = firstFinite(primary, ["netProfit", "netPnl", "netPl"]);
  if (net != null) return net;

  const profit = firstFinite(primary, ["profit", "pnl", "grossPl", "grossPL"]);
  if (profit != null) {
    if (orderSwap !== 0 || orderCommission !== 0) {
      return profit + orderSwap + orderCommission;
    }
    return profit;
  }

  const realized = firstFinite(primary, ["realizedPl", "realizedPL"]);
  if (realized != null) return realized;

  if (closeOrder) return fallbackGross + orderSwap + orderCommission;
  return 0;
}

async function main() {
  const { data: rows, error } = await supabase
    .from("broker_trade_history")
    .select("id, broker_position_id, realized_pl, raw_payload")
    .not("raw_payload", "is", null);

  if (error) {
    console.error("Fetch history failed:", error.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows || []) {
    const raw = row.raw_payload;
    const openOrder = raw?.openOrder;
    const closeOrder = raw?.closeOrder;
    if (!openOrder && !closeOrder) {
      skipped++;
      continue;
    }

    const orderSwap =
      Number(openOrder?.swap || 0) + Number(closeOrder?.swap || 0);
    const orderCommission =
      Number(openOrder?.commission || 0) + Number(closeOrder?.commission || 0);
    const net = extractBrokerNetPl(
      openOrder,
      closeOrder,
      Number(row.realized_pl || 0),
      orderSwap,
      orderCommission,
    );

    const { error: histErr } = await supabase
      .from("broker_trade_history")
      .update({ realized_pl: net })
      .eq("id", row.id);
    if (histErr) {
      console.warn("History update", row.id, histErr.message);
      continue;
    }

    if (row.broker_position_id) {
      const { error: tradeErr } = await supabase
        .from("trades")
        .update({ result: net, swap: 0, commission: 0 })
        .eq("broker_position_id", row.broker_position_id)
        .eq("broker_name", "TradeLocker");
      if (tradeErr) {
        console.warn("Trade update", row.broker_position_id, tradeErr.message);
      }
    }

    updated++;
  }

  console.log(`Backfill complete: ${updated} positions updated, ${skipped} skipped.`);

  const { data: connections } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("platform", "tradelocker")
    .eq("connection_status", "connected");

  console.log(
    `Connected TradeLocker accounts: ${connections?.length || 0}. Open the app (or Settings → Sync) once to refresh todayNet on the calendar.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
