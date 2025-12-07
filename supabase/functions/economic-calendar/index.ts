import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  "US": "USD", "USD": "USD",
  "GB": "GBP", "UK": "GBP", "GBP": "GBP",
  "EU": "EUR", "EUR": "EUR", "EMU": "EUR",
  "DE": "EUR", "FR": "EUR", "IT": "EUR", "ES": "EUR",
  "JP": "JPY", "JPY": "JPY",
  "AU": "AUD", "AUD": "AUD",
  "CA": "CAD", "CAD": "CAD",
  "NZ": "NZD", "NZD": "NZD",
  "CH": "CHF", "CHF": "CHF",
  "CN": "CNY", "CNY": "CNY",
};

// Country flags
const countryFlags: Record<string, string> = {
  "US": "🇺🇸", "USD": "🇺🇸",
  "GB": "🇬🇧", "UK": "🇬🇧", "GBP": "🇬🇧",
  "EU": "🇪🇺", "EUR": "🇪🇺", "EMU": "🇪🇺",
  "DE": "🇩🇪", "FR": "🇫🇷", "IT": "🇮🇹", "ES": "🇪🇸",
  "JP": "🇯🇵", "JPY": "🇯🇵",
  "AU": "🇦🇺", "AUD": "🇦🇺",
  "CA": "🇨🇦", "CAD": "🇨🇦",
  "NZ": "🇳🇿", "NZD": "🇳🇿",
  "CH": "🇨🇭", "CHF": "🇨🇭",
  "CN": "🇨🇳", "CNY": "🇨🇳",
};

async function fetchEconomicEvents(): Promise<EconomicEvent[]> {
  console.log("Fetching economic calendar from FCS API...");
  
  // Using the free FCS API for economic calendar
  // Alternative: investing.com calendar widget data
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  
  try {
    // Fetch from the free ForexFactory-style calendar
    // Using a public calendar feed
    const response = await fetch(
      `https://nfs.faireconomy.media/ff_calendar_thisweek.json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      console.error(`Calendar API error: ${response.status}`);
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data?.length || 0} events`);
    
    if (!Array.isArray(data)) {
      console.log("Unexpected data format, returning empty array");
      return [];
    }
    
    const events: EconomicEvent[] = data.map((event: any, index: number) => {
      // Parse the date
      const eventDate = new Date(event.date);
      const dateStr = eventDate.toISOString().split('T')[0];
      const timeStr = eventDate.toTimeString().substring(0, 5);
      
      // Map impact level
      let impact: "low" | "medium" | "high" = "low";
      if (event.impact === "High" || event.impact === "high") {
        impact = "high";
      } else if (event.impact === "Medium" || event.impact === "medium") {
        impact = "medium";
      }
      
      const countryCode = event.country || "US";
      const currency = countryCurrency[countryCode] || "USD";
      
      return {
        id: `${dateStr}-${countryCode}-${index}`,
        title: event.title || event.name || "Unknown Event",
        country: getCountryName(countryCode),
        countryCode: countryCode,
        date: dateStr,
        time: timeStr,
        impact: impact,
        actual: event.actual || undefined,
        forecast: event.forecast || undefined,
        previous: event.previous || undefined,
        currency: currency,
      };
    });
    
    // Sort by date and time
    events.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
    
    console.log(`Processed ${events.length} events successfully`);
    return events;
    
  } catch (error) {
    console.error("Error fetching from primary source:", error);
    throw error;
  }
}

function getCountryName(code: string): string {
  const countryNames: Record<string, string> = {
    "US": "United States", "USD": "United States",
    "GB": "United Kingdom", "UK": "United Kingdom", "GBP": "United Kingdom",
    "EU": "European Union", "EUR": "European Union", "EMU": "Eurozone",
    "DE": "Germany", "FR": "France", "IT": "Italy", "ES": "Spain",
    "JP": "Japan", "JPY": "Japan",
    "AU": "Australia", "AUD": "Australia",
    "CA": "Canada", "CAD": "Canada",
    "NZ": "New Zealand", "NZD": "New Zealand",
    "CH": "Switzerland", "CHF": "Switzerland",
    "CN": "China", "CNY": "China",
  };
  return countryNames[code] || code;
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
        source: "ForexFactory"
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
