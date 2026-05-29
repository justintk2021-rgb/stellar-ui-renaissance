import json
import os
import socket
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import MetaTrader5 as mt5
import requests

BRIDGE_VERSION = "0.1.0"


def load_env_file() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def to_iso(timestamp: Any) -> Optional[str]:
    if timestamp in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def namedtuple_to_dict(value: Any) -> Dict[str, Any]:
    if hasattr(value, "_asdict"):
        return dict(value._asdict())
    return dict(value)


class Mt5Bridge:
    def __init__(self) -> None:
        load_env_file()
        supabase_url = require_env("SUPABASE_URL").rstrip("/")
        self.function_url = f"{supabase_url}/functions/v1/mt5-bridge"
        self.anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        self.bridge_key = require_env("MT5_BRIDGE_KEY")
        self.mt5_login = 0
        self.mt5_password = ""
        self.mt5_server = ""
        self.sync_interval = int(os.getenv("SYNC_INTERVAL_SECONDS", "30"))
        self.history_days = int(os.getenv("HISTORY_DAYS", "90"))
        self.session = requests.Session()
        self.last_sync_at = 0.0
        self.last_heartbeat_at = 0.0

    def headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "x-bridge-key": self.bridge_key,
        }
        if self.anon_key:
            headers["apikey"] = self.anon_key
        return headers

    def post(self, action: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        body = {"action": action}
        if payload:
            body.update(payload)
        response = self.session.post(self.function_url, headers=self.headers(), json=body, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data.get("error"):
            raise RuntimeError(str(data["error"]))
        return data

    def initialize_mt5(self) -> None:
        self.fetch_bridge_config()
        if mt5.initialize(login=self.mt5_login, password=self.mt5_password, server=self.mt5_server):
            return
        code, message = mt5.last_error()
        raise RuntimeError(f"Could not initialize and log in to MT5: {code} {message}")

    def fetch_bridge_config(self) -> None:
        config = self.post("bridge-config")
        self.mt5_login = int(config["mt5Login"])
        self.mt5_password = str(config["mt5Password"])
        self.mt5_server = str(config["mt5Server"])

    def account_payload(self) -> Dict[str, Any]:
        account = mt5.account_info()
        if account is None:
            code, message = mt5.last_error()
            raise RuntimeError(f"MT5 account_info failed: {code} {message}")

        data = namedtuple_to_dict(account)
        return {
            "login": data.get("login"),
            "name": data.get("name"),
            "server": data.get("server"),
            "company": data.get("company"),
            "currency": data.get("currency"),
            "balance": data.get("balance"),
            "equity": data.get("equity"),
            "margin": data.get("margin"),
            "margin_free": data.get("margin_free"),
            "profit": data.get("profit"),
        }

    def positions_payload(self) -> List[Dict[str, Any]]:
        positions = mt5.positions_get() or []
        result = []
        for position in positions:
            data = namedtuple_to_dict(position)
            side = "buy" if data.get("type") == mt5.POSITION_TYPE_BUY else "sell"
            result.append({
                "ticket": data.get("ticket"),
                "position_id": data.get("identifier") or data.get("ticket"),
                "symbol": data.get("symbol"),
                "side": side,
                "volume": data.get("volume"),
                "open_price": data.get("price_open"),
                "current_price": data.get("price_current"),
                "stop_loss": data.get("sl"),
                "take_profit": data.get("tp"),
                "profit": data.get("profit"),
                "swap": data.get("swap"),
                "commission": data.get("commission"),
                "open_time": to_iso(data.get("time")),
                "magic": data.get("magic"),
                "comment": data.get("comment"),
                "raw": data,
            })
        return result

    def orders_payload(self) -> List[Dict[str, Any]]:
        orders = mt5.orders_get() or []
        result = []
        for order in orders:
            data = namedtuple_to_dict(order)
            side = "sell" if data.get("type") in (mt5.ORDER_TYPE_SELL_LIMIT, mt5.ORDER_TYPE_SELL_STOP, mt5.ORDER_TYPE_SELL_STOP_LIMIT) else "buy"
            result.append({
                "ticket": data.get("ticket"),
                "order_id": data.get("ticket"),
                "symbol": data.get("symbol"),
                "side": side,
                "order_type": str(data.get("type")),
                "volume": data.get("volume_current") or data.get("volume_initial"),
                "price_open": data.get("price_open"),
                "stop_loss": data.get("sl"),
                "take_profit": data.get("tp"),
                "status": str(data.get("state")),
                "time_setup": to_iso(data.get("time_setup")),
                "magic": data.get("magic"),
                "comment": data.get("comment"),
                "raw": data,
            })
        return result

    def history_payload(self) -> List[Dict[str, Any]]:
        utc_to = datetime.now(timezone.utc)
        utc_from = utc_to - timedelta(days=self.history_days)
        deals = mt5.history_deals_get(utc_from, utc_to) or []
        result = []
        for deal in deals:
            data = namedtuple_to_dict(deal)
            if data.get("entry") not in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT, mt5.DEAL_ENTRY_OUT_BY):
                continue
            if data.get("symbol") is None:
                continue
            side = "sell" if data.get("type") in (mt5.DEAL_TYPE_SELL, mt5.DEAL_TYPE_SELL_CANCELED) else "buy"
            result.append({
                "ticket": data.get("ticket"),
                "order_id": data.get("order"),
                "position_id": data.get("position_id"),
                "symbol": data.get("symbol"),
                "side": side,
                "volume": data.get("volume"),
                "entry_price": data.get("price"),
                "exit_price": data.get("price"),
                "profit": data.get("profit"),
                "swap": data.get("swap"),
                "commission": data.get("commission"),
                "opened_at": to_iso(data.get("time")),
                "closed_at": to_iso(data.get("time")),
                "comment": data.get("comment"),
                "raw": data,
            })
        return result

    def sync_snapshot(self) -> None:
        payload = {
            "account": self.account_payload(),
            "positions": self.positions_payload(),
            "orders": self.orders_payload(),
            "history": self.history_payload(),
        }
        result = self.post("sync-snapshot", payload)
        print(f"Synced MT5 snapshot: {json.dumps(result.get('stats', {}))}")

    def heartbeat(self, error: Optional[str] = None) -> None:
        self.post("heartbeat", {
            "bridgeVersion": BRIDGE_VERSION,
            "machineName": socket.gethostname(),
            "error": error,
        })

    def poll_commands(self) -> Iterable[Dict[str, Any]]:
        data = self.post("poll-commands")
        return data.get("commands", [])

    def send_command_result(self, command_id: str, success: bool, result: Optional[Dict[str, Any]] = None, error: Optional[str] = None) -> None:
        self.post("command-result", {
            "commandId": command_id,
            "success": success,
            "result": result or {},
            "error": error,
        })

    def ensure_symbol(self, symbol: str) -> None:
        info = mt5.symbol_info(symbol)
        if info is None:
            raise RuntimeError(f"Symbol not found in MT5: {symbol}")
        if not info.visible and not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"Could not select symbol in Market Watch: {symbol}")

    def market_price(self, symbol: str, side: str) -> float:
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise RuntimeError(f"No tick data available for {symbol}")
        return float(tick.ask if side == "buy" else tick.bid)

    def order_type(self, side: str, order_kind: str) -> int:
        side = side.lower()
        order_kind = order_kind.lower()
        if order_kind == "market":
            return mt5.ORDER_TYPE_BUY if side == "buy" else mt5.ORDER_TYPE_SELL
        if order_kind == "limit":
            return mt5.ORDER_TYPE_BUY_LIMIT if side == "buy" else mt5.ORDER_TYPE_SELL_LIMIT
        if order_kind == "stop":
            return mt5.ORDER_TYPE_BUY_STOP if side == "buy" else mt5.ORDER_TYPE_SELL_STOP
        raise RuntimeError(f"Unsupported order type: {order_kind}")

    def execute_place_order(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        symbol = str(payload["symbol"]).upper()
        side = str(payload.get("side", "buy")).lower()
        order_kind = str(payload.get("type") or payload.get("order_type") or "market").lower()
        volume = float(payload.get("volume") or payload.get("qty") or payload.get("size"))
        self.ensure_symbol(symbol)

        request: Dict[str, Any] = {
            "action": mt5.TRADE_ACTION_DEAL if order_kind == "market" else mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": volume,
            "type": self.order_type(side, order_kind),
            "deviation": int(payload.get("deviation", 20)),
            "magic": int(payload.get("magic", 20260525)),
            "comment": str(payload.get("comment", "Stellar UI MT5 bridge")),
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        request["price"] = float(payload.get("price") or self.market_price(symbol, side))
        if payload.get("stopLoss") is not None or payload.get("stop_loss") is not None:
            request["sl"] = float(payload.get("stopLoss") or payload.get("stop_loss"))
        if payload.get("takeProfit") is not None or payload.get("take_profit") is not None:
            request["tp"] = float(payload.get("takeProfit") or payload.get("take_profit"))

        return self.send_mt5_order(request)

    def execute_close_position(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ticket = int(payload.get("positionId") or payload.get("position_id"))
        matches = mt5.positions_get(ticket=ticket)
        if not matches:
            raise RuntimeError(f"Position not found: {ticket}")

        position = namedtuple_to_dict(matches[0])
        symbol = str(position["symbol"])
        side = "sell" if position["type"] == mt5.POSITION_TYPE_BUY else "buy"
        volume = float(payload.get("volume") or payload.get("qty") or position["volume"])
        self.ensure_symbol(symbol)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": ticket,
            "symbol": symbol,
            "volume": volume,
            "type": mt5.ORDER_TYPE_SELL if side == "sell" else mt5.ORDER_TYPE_BUY,
            "price": self.market_price(symbol, side),
            "deviation": int(payload.get("deviation", 20)),
            "magic": int(payload.get("magic", 20260525)),
            "comment": str(payload.get("comment", "Stellar UI close")),
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        return self.send_mt5_order(request)

    def execute_modify_position(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ticket = int(payload.get("positionId") or payload.get("position_id"))
        request: Dict[str, Any] = {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": ticket,
        }
        if payload.get("stopLoss") is not None or payload.get("stop_loss") is not None:
            request["sl"] = float(payload.get("stopLoss") or payload.get("stop_loss"))
        if payload.get("takeProfit") is not None or payload.get("take_profit") is not None:
            request["tp"] = float(payload.get("takeProfit") or payload.get("take_profit"))
        return self.send_mt5_order(request)

    def execute_cancel_order(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        order_id = int(payload.get("orderId") or payload.get("order_id"))
        return self.send_mt5_order({"action": mt5.TRADE_ACTION_REMOVE, "order": order_id})

    def execute_modify_order(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        order_id = int(payload.get("orderId") or payload.get("order_id"))
        request: Dict[str, Any] = {
            "action": mt5.TRADE_ACTION_MODIFY,
            "order": order_id,
        }
        if payload.get("price") is not None:
            request["price"] = float(payload["price"])
        if payload.get("stopLoss") is not None or payload.get("stop_loss") is not None:
            request["sl"] = float(payload.get("stopLoss") or payload.get("stop_loss"))
        if payload.get("takeProfit") is not None or payload.get("take_profit") is not None:
            request["tp"] = float(payload.get("takeProfit") or payload.get("take_profit"))
        return self.send_mt5_order(request)

    def send_mt5_order(self, request: Dict[str, Any]) -> Dict[str, Any]:
        result = mt5.order_send(request)
        if result is None:
            code, message = mt5.last_error()
            raise RuntimeError(f"MT5 order_send failed: {code} {message}")

        data = namedtuple_to_dict(result)
        if data.get("retcode") != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"MT5 rejected command: retcode={data.get('retcode')} comment={data.get('comment')}")
        return data

    def execute_command(self, command: Dict[str, Any]) -> None:
        command_id = command["id"]
        command_type = command["command_type"]
        payload = command.get("payload") or {}
        try:
            if command_type == "place_order":
                result = self.execute_place_order(payload)
            elif command_type == "close_position":
                result = self.execute_close_position(payload)
            elif command_type == "modify_position":
                result = self.execute_modify_position(payload)
            elif command_type == "cancel_order":
                result = self.execute_cancel_order(payload)
            elif command_type == "modify_order":
                result = self.execute_modify_order(payload)
            else:
                raise RuntimeError(f"Unsupported command type: {command_type}")

            self.send_command_result(command_id, True, result=result)
            print(f"Completed command {command_id}: {command_type}")
            self.sync_snapshot()
        except Exception as exc:
            self.send_command_result(command_id, False, error=str(exc))
            print(f"Failed command {command_id}: {exc}", file=sys.stderr)

    def run_forever(self) -> None:
        self.initialize_mt5()
        print("MT5 bridge started. Keep MetaTrader 5 open and logged in.")
        self.heartbeat()
        self.sync_snapshot()

        while True:
            now = time.monotonic()
            try:
                if now - self.last_heartbeat_at >= 15:
                    self.heartbeat()
                    self.last_heartbeat_at = now

                if now - self.last_sync_at >= self.sync_interval:
                    self.sync_snapshot()
                    self.last_sync_at = now
            except Exception as exc:
                print(f"Bridge loop error: {exc}", file=sys.stderr)
                try:
                    self.heartbeat(error=str(exc))
                except Exception:
                    pass
                time.sleep(5)

            time.sleep(2)


if __name__ == "__main__":
    try:
        Mt5Bridge().run_forever()
    except KeyboardInterrupt:
        print("MT5 bridge stopped.")
    finally:
        mt5.shutdown()
