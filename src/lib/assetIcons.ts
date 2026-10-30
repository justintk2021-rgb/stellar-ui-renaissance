import goldUrl from "@/assets/asset-icons/gold.svg?url";
import silverUrl from "@/assets/asset-icons/silver.svg?url";
import oilUrl from "@/assets/asset-icons/oil.svg?url";
import gasUrl from "@/assets/asset-icons/gas.svg?url";
import copperUrl from "@/assets/asset-icons/copper.svg?url";
import platinumUrl from "@/assets/asset-icons/platinum.svg?url";
import palladiumUrl from "@/assets/asset-icons/palladium.svg?url";
import { COUNTRY_FLAG_URL, CURRENCY_FLAG_URL } from "@/lib/assetIconFlags";
import { CRYPTO_ICON_URL, CRYPTO_TICKERS } from "@/lib/assetIconCrypto";

export type AssetIconSize = "sm" | "md" | "lg";

export type ResolvedAssetIcon =
  | { kind: "pair"; front: string; back: string; letters: string }
  | { kind: "badge"; src: string; letters: string }
  | { kind: "stock"; ticker: string; src: string; letters: string }
  | { kind: "unknown"; letters: string };

const QUOTE_CODES = new Set([
  "USD", "USDT", "USDC", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD",
  "HKD", "SGD", "CNH", "CNY",
]);

const METAL_ICON: Record<string, string> = {
  XAU: goldUrl,
  GOLD: goldUrl,
  XAG: silverUrl,
  SILVER: silverUrl,
  XPT: platinumUrl,
  PLAT: platinumUrl,
  XPD: palladiumUrl,
  PALL: palladiumUrl,
  XCU: copperUrl,
  COPPER: copperUrl,
  HG: copperUrl,
};

const ENERGY_ICON: Record<string, string> = {
  USOIL: oilUrl,
  WTI: oilUrl,
  CRUDE: oilUrl,
  CL: oilUrl,
  XTICOIL: oilUrl,
  UKOIL: oilUrl,
  BRENT: oilUrl,
  NATGAS: gasUrl,
  NGAS: gasUrl,
  NG: gasUrl,
};

const INDEX_COUNTRY: Record<string, string> = {
  US30: "US",
  DJ30: "US",
  DJI: "US",
  DOW: "US",
  WALLSTREET: "US",
  NAS100: "US",
  USTEC: "US",
  NASDAQ: "US",
  NDX: "US",
  US100: "US",
  SPX500: "US",
  US500: "US",
  SPX: "US",
  SP500: "US",
  US2000: "US",
  RUT: "US",
  RUSSELL: "US",
  GER40: "DE",
  GER30: "DE",
  DAX: "DE",
  DE40: "DE",
  UK100: "GB",
  FTSE: "GB",
  UKX: "GB",
  FTSE100: "GB",
  JP225: "JP",
  JPN225: "JP",
  NI225: "JP",
  NIKKEI: "JP",
  FRA40: "FR",
  CAC: "FR",
  CAC40: "FR",
  FR40: "FR",
  AUS200: "AU",
  AU200: "AU",
  ASX200: "AU",
  HK50: "HK",
  HSI: "HK",
  HK33: "HK",
  EU50: "EU",
  STOXX50: "EU",
  SX5E: "EU",
  ESTX50: "EU",
  ES35: "ES",
  SPA35: "ES",
  IBEX: "ES",
  IT40: "IT",
  FTSEMIB: "IT",
  CHINA50: "CN",
  CN50: "CN",
  SWI20: "CH",
  SMI: "CH",
  NETH25: "NL",
  AEX: "NL",
  SING30: "SG",
  STI: "SG",
};

const STOCK_LOGO = (ticker: string) =>
  `https://financialmodelingprep.com/image-stock/${encodeURIComponent(ticker)}.png`;

const failedStockTickers = new Set<string>();

export function markStockLogoFailed(ticker: string) {
  failedStockTickers.add(ticker);
}

export function stockLogoFailed(ticker: string) {
  return failedStockTickers.has(ticker);
}

/**
 * Strip broker prefixes/suffixes so TradeLocker, MT5 and Myfxbook
 * tickers resolve to the same asset (EURUSD.m, EURUSDm, OANDA:EURUSD, XAUUSD+).
 */
export function normalizeSymbol(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().toUpperCase();
  const colon = s.lastIndexOf(":");
  if (colon >= 0) s = s.slice(colon + 1);
  s = s.replace(/[/_\s-]+/g, "");
  s = s.replace(/[^A-Z0-9.]/g, "");
  s = s.replace(/\.(M|I|PRO|SB|C|CASH|SPOT|MICRO|ECN|STD|RAW|ZERO)$/i, "");
  if (/\.CASH$/i.test(s)) s = s.replace(/\.CASH$/i, "");
  s = s.replace(/\./g, "");
  if (s.endsWith("CASH") && s.length > 6) s = s.slice(0, -4);
  if (/^[A-Z]{6}M$/.test(s)) s = s.slice(0, 6);
  return s;
}

export function fallbackLetters(symbol: string): string {
  const s = normalizeSymbol(symbol) || (symbol || "").trim().toUpperCase();
  if (!s) return "?";
  if (s.length === 1) return s;
  if (/^[A-Z]{6}$/.test(s)) return s.slice(0, 2);
  return s.slice(0, 2);
}

function isCurrency(code: string): boolean {
  return code in CURRENCY_FLAG_URL;
}

function splitQuote(symbol: string): { base: string; quote: string } | null {
  for (const quote of QUOTE_CODES) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      return { base: symbol.slice(0, -quote.length), quote };
    }
  }
  if (symbol.length === 6) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3);
    if (isCurrency(base) && isCurrency(quote)) return { base, quote };
  }
  return null;
}

function pairVisual(
  front: string | undefined,
  back: string | undefined,
  letters: string,
): ResolvedAssetIcon | null {
  if (!front) return null;
  if (back) return { kind: "pair", front, back, letters };
  return { kind: "badge", src: front, letters };
}

const resolveCache = new Map<string, ResolvedAssetIcon>();

/** Resolve a broker/journal symbol to the visuals AssetIcon should render. */
export function resolveAssetIcon(raw: string | null | undefined): ResolvedAssetIcon {
  const key = (raw || "").trim().toUpperCase();
  const cached = resolveCache.get(key);
  if (cached) return cached;

  const symbol = normalizeSymbol(raw);
  const letters = fallbackLetters(symbol || key);
  let resolved: ResolvedAssetIcon = { kind: "unknown", letters };

  if (symbol) {
    const indexCountry = INDEX_COUNTRY[symbol];
    if (indexCountry) {
      const flag = COUNTRY_FLAG_URL[indexCountry] ?? CURRENCY_FLAG_URL[indexCountry];
      if (flag) resolved = { kind: "badge", src: flag, letters };
    } else if (ENERGY_ICON[symbol]) {
      resolved = { kind: "badge", src: ENERGY_ICON[symbol], letters };
    } else if (METAL_ICON[symbol]) {
      resolved = { kind: "badge", src: METAL_ICON[symbol], letters };
    } else {
      const parts = splitQuote(symbol);
      if (parts) {
        const { base, quote } = parts;
        const quoteFlag = CURRENCY_FLAG_URL[quote];
        if (INDEX_COUNTRY[base]) {
          const flag = COUNTRY_FLAG_URL[INDEX_COUNTRY[base]] ?? quoteFlag;
          if (flag) resolved = { kind: "badge", src: flag, letters };
        } else if (ENERGY_ICON[base]) {
          resolved = pairVisual(ENERGY_ICON[base], quoteFlag, letters) ?? resolved;
        } else if (METAL_ICON[base]) {
          resolved = pairVisual(METAL_ICON[base], quoteFlag, letters) ?? resolved;
        } else if (CRYPTO_TICKERS.has(base) || CRYPTO_ICON_URL[base]) {
          resolved = pairVisual(CRYPTO_ICON_URL[base], quoteFlag, letters)
            ?? { kind: "unknown", letters: base.slice(0, 2) };
        } else if (isCurrency(base) && isCurrency(quote)) {
          resolved = pairVisual(CURRENCY_FLAG_URL[base], quoteFlag, letters) ?? resolved;
        }
      } else if (CRYPTO_ICON_URL[symbol] || CRYPTO_TICKERS.has(symbol)) {
        resolved = CRYPTO_ICON_URL[symbol]
          ? { kind: "badge", src: CRYPTO_ICON_URL[symbol], letters }
          : { kind: "unknown", letters };
      } else if (/^[A-Z]{1,5}$/.test(symbol) && !isCurrency(symbol)) {
        resolved = {
          kind: "stock",
          ticker: symbol,
          src: STOCK_LOGO(symbol),
          letters,
        };
      }
    }
  }

  resolveCache.set(key, resolved);
  return resolved;
}

export function shouldRenderAssetIcon(raw: string | null | undefined): boolean {
  const resolved = resolveAssetIcon(raw);
  return resolved.kind !== "unknown";
}

export const ASSET_ICON_PX: Record<AssetIconSize, { box: number; face: number; overlap: number }> = {
  sm: { box: 16, face: 12, overlap: 5 },
  md: { box: 22, face: 16, overlap: 7 },
  lg: { box: 32, face: 22, overlap: 9 },
};

export function pairBoxWidth(size: AssetIconSize): number {
  const { face, overlap } = ASSET_ICON_PX[size];
  return face * 2 - overlap;
}
