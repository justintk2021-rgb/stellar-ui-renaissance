import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

type CalendarSource = "forexfactory" | "finnhub";

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;
  time: string;
  impact: "low" | "medium" | "high";
  actual?: string;
  forecast?: string;
  previous?: string;
  currency: string;
  timestamp: number;
}

/** FF feed uses currency codes in the `country` field (USD, EUR, …). */
const currencyToCountry: Record<string, string> = {
  USD: "US",
  GBP: "GB",
  EUR: "EU",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
  NZD: "NZ",
  CHF: "CH",
  CNY: "CN",
};

/** Reverse map: Finnhub gives 2-letter country codes — map back to currency. */
const countryToCurrency: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  UK: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  NZ: "NZD",
  CH: "CHF",
  CN: "CNY",
};

const countryNames: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  EU: "European Union",
  JP: "Japan",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  CH: "Switzerland",
  CN: "China",
  DE: "Germany",
  FR: "France",
};

function normalizeImpact(raw: string): "low" | "medium" | "high" {
  const v = (raw || "").toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

function parseFfEvent(raw: Record<string, string>, index: number): EconomicEvent | null {
  const dateIso = raw.date;
  if (!dateIso) return null;

  const eventDate = new Date(dateIso);
  if (Number.isNaN(eventDate.getTime())) return null;

  const currency = (raw.country || "USD").toUpperCase();
  const countryCode = currencyToCountry[currency] || currency.slice(0, 2);
  const dateStr = eventDate.toISOString().split("T")[0];
  const timeStr = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const title = raw.title || raw.name || "Economic Event";
  const slug = title.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);

  return {
    id: `${dateStr}-${currency}-${slug}-${index}`,
    title,
    country: countryNames[countryCode] || currency,
    countryCode,
    date: dateStr,
    time: timeStr,
    impact: normalizeImpact(raw.impact || ""),
    actual: raw.actual?.trim() || undefined,
    forecast: raw.forecast?.trim() || undefined,
    previous: raw.previous?.trim() || undefined,
    currency,
    timestamp: eventDate.getTime(),
  };
}

async function fetchForexFactoryWeek(): Promise<EconomicEvent[]> {
  const response = await fetch(FF_CALENDAR_URL, {
    headers: {
      "User-Agent": "NSYNC-Journal/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Calendar feed unavailable (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected calendar feed format");
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 14);
  end.setHours(23, 59, 59, 999);

  const events = data
    .map((row: Record<string, string>, i: number) => parseFfEvent(row, i))
    .filter((e: EconomicEvent | null): e is EconomicEvent => e !== null)
    .filter((e: EconomicEvent) => e.timestamp >= start.getTime() && e.timestamp <= end.getTime())
    .sort((a: EconomicEvent, b: EconomicEvent) => a.timestamp - b.timestamp);

  return events;
}

/**
 * Normalize one Finnhub `/calendar/economic` row into the EconomicEvent shape.
 * Finnhub fields: country (2-letter code), event, time (ISO), impact (1/2/3),
 * actual, estimate → forecast, prev → previous, unit.
 */
function parseFinnhubEvent(row: Record<string, unknown>, index: number): EconomicEvent | null {
  // `time` is ISO ("2026-06-10 12:30:00" or full ISO); fall back to `date`.
  const rawTime = String(row.time || row.date || "");
  if (!rawTime) return null;
  // Finnhub times are UTC; append Z when no timezone is present.
  const iso = rawTime.includes("T") ? rawTime : rawTime.replace(" ", "T");
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  const eventDate = new Date(hasTz ? iso : `${iso}Z`);
  if (Number.isNaN(eventDate.getTime())) return null;

  // impact: 1 = low, 2 = medium, 3 = high (sometimes strings)
  const impactNum = Number(row.impact);
  let impact: "low" | "medium" | "high" = "low";
  if (impactNum >= 3) impact = "high";
  else if (impactNum === 2) impact = "medium";
  else if (typeof row.impact === "string") impact = normalizeImpact(row.impact);

  // `country` may be a 2-letter country code OR a currency code.
  const rawCountry = String(row.country || "US").toUpperCase();
  let countryCode: string;
  let currency: string;
  if (currencyToCountry[rawCountry]) {
    currency = rawCountry;
    countryCode = currencyToCountry[rawCountry];
  } else {
    countryCode = rawCountry.slice(0, 2);
    currency = countryToCurrency[countryCode] || "USD";
  }

  const unit = typeof row.unit === "string" && row.unit.trim() ? row.unit.trim() : "";
  const fmt = (v: unknown): string | undefined => {
    if (v == null || v === "") return undefined;
    // Append short units (%, K, M, B) so values read like the FF feed.
    return unit.length <= 2 ? `${v}${unit}` : String(v);
  };

  const dateStr = eventDate.toISOString().split("T")[0];
  const timeStr = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const title = String(row.event || "Economic Event");
  const slug = title.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40);

  return {
    id: `fh-${dateStr}-${currency}-${slug}-${index}`,
    title,
    country: countryNames[countryCode] || rawCountry,
    countryCode,
    date: dateStr,
    time: timeStr,
    impact,
    actual: fmt(row.actual),
    forecast: fmt(row.estimate),
    previous: fmt(row.prev),
    currency,
    timestamp: eventDate.getTime(),
  };
}

async function fetchFinnhubCalendar(): Promise<EconomicEvent[] | null> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set — skipping Finnhub fallback");
    return null;
  }

  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Finnhub responded ${response.status}`);
    return null;
  }

  const data = await response.json();
  const rows = data?.economicCalendar?.economicCalendar ?? data?.economicCalendar;
  if (!Array.isArray(rows)) return null;

  return rows
    .map((row: Record<string, unknown>, i: number) => parseFinnhubEvent(row, i))
    .filter((e: EconomicEvent | null): e is EconomicEvent => e !== null)
    .sort((a: EconomicEvent, b: EconomicEvent) => a.timestamp - b.timestamp);
}

interface CalendarResult {
  events: EconomicEvent[];
  source: CalendarSource;
}

// Simple in-memory cache (per warm function instance) — 5 minutes.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { result: CalendarResult; cachedAt: number }>();

async function fetchEconomicEvents(): Promise<CalendarResult> {
  const cached = cache.get("calendar");
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  // 1) ForexFactory first
  let ffEvents: EconomicEvent[] = [];
  try {
    ffEvents = await fetchForexFactoryWeek();
  } catch (err) {
    console.error("ForexFactory feed failed:", err);
  }

  let result: CalendarResult;
  if (ffEvents.length > 0) {
    result = { events: ffEvents, source: "forexfactory" };
  } else {
    // 2) Finnhub fallback (null when key missing or request failed)
    const finnhub = await fetchFinnhubCalendar();
    if (finnhub && finnhub.length > 0) {
      result = { events: finnhub, source: "finnhub" };
    } else {
      // 3) Both unavailable — return the FF result (even if empty) gracefully.
      result = { events: ffEvents, source: "forexfactory" };
    }
  }

  // Only cache results that actually have data, so transient outages retry.
  if (result.events.length > 0) {
    cache.set("calendar", { result, cachedAt: Date.now() });
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { events, source } = await fetchEconomicEvents();

    return new Response(
      JSON.stringify({
        events,
        lastUpdated: new Date().toISOString(),
        source,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("economic-calendar error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage, events: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
