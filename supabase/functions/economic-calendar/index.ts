import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

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

  const now = Date.now();
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

async function fetchFinnhubCalendar(): Promise<EconomicEvent[] | null> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) return null;

  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromStr}&to=${toStr}&token=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const rows = data?.economicCalendar;
  if (!Array.isArray(rows)) return null;

  return rows
    .map((row: Record<string, unknown>, i: number) => {
      const dateStr = String(row.date || "");
      const timeStr = String(row.time || "00:00");
      const eventDate = new Date(`${dateStr}T${timeStr}:00`);
      if (Number.isNaN(eventDate.getTime())) return null;

      const impactNum = Number(row.impact);
      let impact: "low" | "medium" | "high" = "low";
      if (impactNum >= 3) impact = "high";
      else if (impactNum === 2) impact = "medium";

      const currency = String(row.unit || row.currency || "USD").toUpperCase();
      const countryCode = currencyToCountry[currency] || "US";

      return {
        id: `fh-${dateStr}-${i}`,
        title: String(row.event || "Economic Event"),
        country: countryNames[countryCode] || countryCode,
        countryCode,
        date: dateStr,
        time: timeStr.slice(0, 5),
        impact,
        actual: row.actual != null ? String(row.actual) : undefined,
        forecast: row.estimate != null ? String(row.estimate) : undefined,
        previous: row.prev != null ? String(row.prev) : undefined,
        currency,
        timestamp: eventDate.getTime(),
      } satisfies EconomicEvent;
    })
    .filter((e: EconomicEvent | null): e is EconomicEvent => e !== null)
    .sort((a: EconomicEvent, b: EconomicEvent) => a.timestamp - b.timestamp);
}

async function fetchEconomicEvents(): Promise<{
  events: EconomicEvent[];
  source: string;
}> {
  try {
    const events = await fetchForexFactoryWeek();
    if (events.length > 0) {
      return { events, source: "ForexFactory (live)" };
    }
  } catch (err) {
    console.error("ForexFactory feed failed:", err);
  }

  const finnhub = await fetchFinnhubCalendar();
  if (finnhub && finnhub.length > 0) {
    return { events: finnhub, source: "Finnhub" };
  }

  throw new Error("Unable to load live economic calendar");
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
