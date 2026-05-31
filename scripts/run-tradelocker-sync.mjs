/**
 * Run a full TradeLocker sync for all connected accounts (service role).
 * Populates today_net_pnl and refreshes journal trades from the broker API.
 *
 * Usage: node scripts/run-tradelocker-sync.mjs [connectionId]
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
    const out = execSync(
      `npx supabase projects api-keys --project-ref ${projectRef} -o json`,
      { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const keys = JSON.parse(out);
    const row = keys.find((k) => k.name === "service_role");
    return row?.api_key || null;
  } catch (e) {
    console.error(
      "Could not read service_role key from Supabase CLI. Run: npx supabase login",
    );
    return null;
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = resolveServiceRoleKey();

if (!url || !key) {
  console.error("Missing SUPABASE_URL and service role key");
  process.exit(1);
}

const connectionIdArg = process.argv[2];
const supabase = createClient(url, key);

async function main() {
  let connectionIds = [];
  if (connectionIdArg) {
    connectionIds = [connectionIdArg];
  } else {
    const { data, error } = await supabase
      .from("broker_connections")
      .select("id, platform, connection_status, active_account_id")
      .ilike("platform", "%tradelocker%")
      .in("connection_status", ["connected", "expired"])
      .not("active_account_id", "is", null);
    if (error) {
      console.error("Failed to list connections:", error.message);
      process.exit(1);
    }
    connectionIds = (data || []).map((c) => c.id);
  }

  if (connectionIds.length === 0) {
    console.log("No TradeLocker accounts with an active account selected.");
    return;
  }

  const fnUrl = `${url.replace(/\/$/, "")}/functions/v1/tradelocker`;

  for (const connectionId of connectionIds) {
    console.log(`Repairing + syncing connection ${connectionId}...`);
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "sync",
        connectionId,
        clientToday: new Date().toLocaleDateString("en-CA"),
        clientDayStart: (() => {
          const n = new Date();
          return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString();
        })(),
        clientDayEnd: (() => {
          const n = new Date();
          return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999).toISOString();
        })(),
      }),
    });
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    if (!res.ok) {
      console.error(`  Failed (${res.status}):`, payload.error || payload);
      continue;
    }
    console.log("  OK:", payload.message || payload.stats);

    const { data: conn } = await supabase
      .from("broker_connections")
      .select("today_net_pnl, today_gross_pnl, today_fees, today_pnl_synced_at")
      .eq("id", connectionId)
      .single();
    if (conn) {
      console.log(
        `  Broker today: net=${conn.today_net_pnl} gross=${conn.today_gross_pnl} fees=${conn.today_fees} synced=${conn.today_pnl_synced_at}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
