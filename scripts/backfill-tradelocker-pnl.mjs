/**
 * Recompute TradeLocker P/L from stored open/close order payloads.
 * Mirrors supabase/functions/tradelocker/index.ts (pip FX, contract size elsewhere).
 *
 * Usage: node scripts/backfill-tradelocker-pnl.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
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

function resolveServiceRoleKey() {
  const fromEnv =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (fromEnv) return fromEnv;
  const projectRef =
    process.env.VITE_SUPABASE_PROJECT_ID || "nmcrsrszbzitvauzdfrl";
  try {
    const keys = JSON.parse(
      execSync(
        `npx supabase projects api-keys --project-ref ${projectRef} -o json`,
        { cwd: root, encoding: "utf8" },
      ),
    );
    return keys.find((k) => k.name === "service_role")?.api_key || null;
  } catch {
    return null;
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = resolveServiceRoleKey();

if (!url || !key) {
  console.error("Missing SUPABASE_URL and service role key");
  process.exit(1);
}

const supabase = createClient(url, key);

const PL_KEYS = [
  "netProfit",
  "netPnl",
  "netPl",
  "realizedPl",
  "realizedPL",
  "profit",
  "pnl",
  "grossPl",
  "grossPL",
];

function firstFinite(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = Number(obj[k]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function extractBrokerNetPl(openOrder, closeOrder, fallbackGross) {
  const primary = closeOrder || openOrder;
  if (!primary) return fallbackGross;
  const fromBroker = firstFinite(primary, PL_KEYS);
  if (fromBroker != null) return fromBroker;
  if (closeOrder && Math.abs(fallbackGross) > 0.0001) return fallbackGross;
  return fallbackGross;
}

function isForexSymbol(symbol) {
  const s = (symbol || "").toUpperCase();
  if (
    s.includes("BTC") ||
    s.includes("ETH") ||
    s.includes("SOL") ||
    s.includes("DOGE") ||
    s.includes("XAU") ||
    s.includes("XAG") ||
    s.includes("OIL") ||
    s.includes("USOIL")
  ) {
    return false;
  }
  return /^[A-Z]{6}$/.test(s) && /^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY)/.test(s);
}

function calculateForexPlUsd(side, entry, exit, qty, symbol) {
  const upper = symbol.toUpperCase();
  const diff = side === "buy" ? exit - entry : entry - exit;
  const pipSize = upper.includes("JPY") ? 0.01 : 0.0001;
  const pips = diff / pipSize;
  const quote = upper.slice(3, 6);
  const pipValueUsd = {
    USD: 10, EUR: 10, GBP: 10, JPY: 9, CAD: 7.5, AUD: 7.5, CHF: 10, NZD: 7,
  };
  const pipUsd = pipValueUsd[quote] ?? 8;
  return pips * pipUsd * qty;
}

function getContractSize(symbol) {
  const s = symbol.toUpperCase();
  if (s.includes("XAU")) return 100;
  if (s.includes("XAG")) return 5000;
  if (s.includes("XPT") || s.includes("XPD")) return 100;
  if (
    s.includes("USOIL") ||
    s.includes("UKOIL") ||
    s.includes("WTI") ||
    s.includes("BRENT") ||
    s.includes("CL")
  ) {
    return 1000;
  }
  if (s.includes("NGAS")) return 10000;
  if (
    s.includes("BTC") ||
    s.includes("ETH") ||
    s.includes("SOL") ||
    s.includes("DOGE")
  ) {
    return 1;
  }
  if (
    s.includes("US30") ||
    s.includes("US500") ||
    s.includes("NAS") ||
    s.includes("SPX")
  ) {
    return 1;
  }
  return 100000;
}

function grossPlFromOrders(openOrder, closeOrder, symbol) {
  if (!openOrder || !closeOrder) return 0;
  const entry = Number(openOrder.avgPrice) || 0;
  const exit = Number(closeOrder.avgPrice) || 0;
  const qty = Number(openOrder.filledQty || openOrder.qty) || 0;
  const side = openOrder.side || "buy";
  if (!entry || !exit || !qty) return 0;
  const upper = (symbol || "").toUpperCase();
  if (isForexSymbol(upper)) {
    return calculateForexPlUsd(side, entry, exit, qty, upper);
  }
  const priceDiff = side === "buy" ? exit - entry : entry - exit;
  return priceDiff * qty * getContractSize(upper);
}

async function main() {
  const { data: rows, error } = await supabase
    .from("broker_trade_history")
    .select("id, broker_position_id, realized_pl, symbol, raw_payload")
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

    const gross = grossPlFromOrders(openOrder, closeOrder, row.symbol || "");
    const net = extractBrokerNetPl(openOrder, closeOrder, gross);

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
