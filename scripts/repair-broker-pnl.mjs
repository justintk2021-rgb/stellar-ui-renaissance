/**
 * One-shot: ensure P&L columns exist, then full TradeLocker sync for all broker accounts.
 * Usage: node scripts/repair-broker-pnl.mjs
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

console.log("=== 1/2 Apply broker P&L columns (if missing) ===\n");
try {
  execSync(
    "npx supabase db query --linked -f scripts/apply-broker-pnl-columns.sql",
    { cwd: root, stdio: "inherit" },
  );
} catch (e) {
  console.warn("SQL step failed (columns may already exist):", e.message || e);
}

console.log("\n=== 2/2 TradeLocker repair + sync ===\n");
execSync("node scripts/run-tradelocker-sync.mjs", { cwd: root, stdio: "inherit" });
