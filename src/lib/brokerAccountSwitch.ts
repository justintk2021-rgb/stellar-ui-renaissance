import { supabase } from "@/integrations/supabase/client";
import {
  BROKER_STORAGE_KEYS,
  writeMt5ConnectionId,
  writeTradeLockerConnectionId,
} from "@/lib/brokerStorage";

export type BrokerPlatform = "tradelocker" | "myfxbook" | "mt5" | string;

async function invokeFunctionError(
  name: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error || data?.error) {
    throw new Error(String(data?.error || error?.message || `${name} request failed`));
  }
}

/** Persist active broker account on the server and in localStorage. */
export async function activateBrokerAccount(params: {
  platform: BrokerPlatform;
  connectionId: string;
  accountId: string;
  accNum: number;
}): Promise<void> {
  const { platform, connectionId, accountId, accNum } = params;

  if (platform === "tradelocker") {
    await invokeFunctionError("tradelocker", {
      action: "select-account",
      connectionId,
      accountId,
      accNum,
    });
    writeTradeLockerConnectionId(connectionId);
    return;
  }

  if (platform === "myfxbook") {
    await invokeFunctionError("myfxbook", {
      action: "selectAccount",
      connectionId,
      accountId,
    });
    return;
  }

  if (platform === "mt5") {
    const { error: deactivateError } = await supabase
      .from("broker_accounts")
      .update({ is_active: false })
      .eq("broker_connection_id", connectionId);
    if (deactivateError) throw deactivateError;

    const { error: activateAccError } = await supabase
      .from("broker_accounts")
      .update({ is_active: true })
      .eq("broker_connection_id", connectionId)
      .eq("acc_num", accNum);
    if (activateAccError) throw activateAccError;

    const { error: connError } = await supabase
      .from("broker_connections")
      .update({
        active_account_id: accountId,
        active_acc_num: accNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    if (connError) throw connError;

    writeMt5ConnectionId(connectionId);
    return;
  }

  throw new Error(`Unsupported broker platform: ${platform}`);
}

export function clearBrokerSelectionStorage() {
  localStorage.removeItem(BROKER_STORAGE_KEYS.selectedBroker);
  writeTradeLockerConnectionId(null);
  writeMt5ConnectionId(null);
}
