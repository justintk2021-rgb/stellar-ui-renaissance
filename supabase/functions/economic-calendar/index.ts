import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinnhubEvent {
  actual?: number;
  country: string;
  estimate?: number;
  event: string;
  impact: string;
  prev?: number;
  time: string;
  unit: string;
}

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
}

// Country to currency mapping
const countryCurrency: Record<string, string> = {
  "US": "USD",
  "United States": "USD",
  "GB": "GBP",
  "United Kingdom": "GBP",
  "EU": "EUR",
  "European Union": "EUR",
  "Eurozone": "EUR",
  "Germany": "EUR",
  "France": "EUR",
  "Italy": "EUR",
  "Spain": "EUR",
  "JP": "JPY",
  "Japan": "JPY",
  "AU": "AUD",
  "Australia": "AUD",
  "CA": "CAD",
  "Canada": "CAD",
  "NZ": "NZD",
  "New Zealand": "NZD",
  "CH": "CHF",
  "Switzerland": "CHF",
  "CN": "CNY",
  "China": "CNY",
};

// Country to code mapping
const countryToCode: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  "European Union": "EU",
  "Eurozone": "EU",
  "Germany": "DE",
  "France": "FR",
  "Italy": "IT",
  "Spain": "ES",
  "Japan": "JP",
  "Australia": "AU",
  "Canada": "CA",
  "New Zealand": "NZ",
  "Switzerland": "CH",
  "China": "CN",
};

// Map Finnhub impact to our impact levels
function mapImpact(impact: string): "low" | "medium" | "high" {
  const impactLower = impact.toLowerCase();
  if (impactLower === "high" || impactLower === "3") return "high";
  if (impactLower === "medium" || impactLower === "2") return "medium";
  return "low";
}

// Format value with unit
function formatValue(value: number | undefined, unit: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  
  if (unit === "%") return `${value}%`;
  if (unit === "K" || unit === "k") return `${value}K`;
  if (unit === "M" || unit === "m") return `${value}M`;
  if (unit === "B" || unit === "b") return `${value}B`;
  
  return value.toString();
}

async function fetchEconomicEvents(): Promise<EconomicEvent[]> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not configured");
    throw new Error("API key not configured");
  }

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const fromDate = today.toISOString().split('T')[0];
  const toDate = nextWeek.toISOString().split('T')[0];
  
  console.log(`Fetching economic calendar from ${fromDate} to ${toDate}`);
  
  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${apiKey}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error(`Finnhub API error: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to fetch from Finnhub: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`Received ${data.economicCalendar?.length || 0} events from Finnhub`);
  
  if (!data.economicCalendar || !Array.isArray(data.economicCalendar)) {
    console.log("No economic calendar data received");
    return [];
  }
  
  const events: EconomicEvent[] = data.economicCalendar.map((event: FinnhubEvent, index: number) => {
    const eventTime = event.time || "00:00:00";
    const [datePart, timePart] = eventTime.includes('T') 
      ? eventTime.split('T') 
      : [eventTime.split(' ')[0], eventTime.split(' ')[1] || "00:00"];
    
    const countryCode = countryToCode[event.country] || event.country.substring(0, 2).toUpperCase();
    const currency = countryCurrency[event.country] || countryCurrency[countryCode] || "USD";
    
    // Extract just HH:MM from time
    const timeFormatted = timePart ? timePart.substring(0, 5) : "00:00";
    
    return {
      id: `${datePart}-${countryCode}-${index}`,
      title: event.event,
      country: event.country,
      countryCode: countryCode,
      date: datePart,
      time: timeFormatted,
      impact: mapImpact(event.impact),
      actual: formatValue(event.actual, event.unit),
      forecast: formatValue(event.estimate, event.unit),
      previous: formatValue(event.prev, event.unit),
      currency: currency,
    };
  });
  
  // Sort by date and time
  events.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
  
  console.log(`Processed ${events.length} events`);
  return events;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Economic calendar function invoked");
    const events = await fetchEconomicEvents();
    
    return new Response(
      JSON.stringify({ 
        events,
        lastUpdated: new Date().toISOString(),
        source: "Finnhub"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error in economic-calendar function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
