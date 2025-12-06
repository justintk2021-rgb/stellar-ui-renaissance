import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert trading assistant for NSYNC Journal - a personal trading journal app. You help traders analyze their performance, provide insights, and can add trades to their journal.

When a user wants to add a trade, use the add_trade function. Extract the following from their description:
- date: The trade date (YYYY-MM-DD format, default to today if not specified)
- pair: The trading pair/symbol (e.g., EURUSD, BTCUSD, AAPL)
- direction: Either "Long" or "Short"
- result: The P&L result in dollars (positive for wins, negative for losses)
- session: Optional - trading session (e.g., "London", "New York", "Asian")
- strategy: Optional - the strategy used
- notes: Optional - any additional notes

Be conversational and helpful. When analyzing trades, focus on:
- Win rate and consistency
- Risk management patterns
- Best performing pairs/sessions/strategies
- Areas for improvement

Keep responses concise but insightful.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    const { messages, tradeContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (tradeContext) {
      contextPrompt += `\n\nCurrent trading data context:
- Total trades: ${tradeContext.totalTrades}
- Win rate: ${tradeContext.winRate}%
- Total P&L: $${tradeContext.totalPnL}
- Average win: $${tradeContext.avgWin}
- Average loss: $${tradeContext.avgLoss}
- Profit factor: ${tradeContext.profitFactor}
- Most traded pairs: ${tradeContext.topPairs}
- Most used sessions: ${tradeContext.topSessions}
- Most used strategies: ${tradeContext.topStrategies}
- Recent trades: ${tradeContext.recentTrades}
- Today's date: ${new Date().toISOString().slice(0, 10)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: contextPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "add_trade",
              description: "Add a new trade to the user's trading journal",
              parameters: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "Trade date in YYYY-MM-DD format"
                  },
                  pair: {
                    type: "string",
                    description: "Trading pair/symbol (e.g., EURUSD, BTCUSD, AAPL)"
                  },
                  direction: {
                    type: "string",
                    enum: ["Long", "Short"],
                    description: "Trade direction"
                  },
                  result: {
                    type: "number",
                    description: "P&L result in dollars (positive for profit, negative for loss)"
                  },
                  session: {
                    type: "string",
                    description: "Trading session (London, New York, Asian, etc.)"
                  },
                  strategy: {
                    type: "string",
                    description: "Strategy used for the trade"
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes about the trade"
                  }
                },
                required: ["date", "pair", "direction", "result"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    
    // Check if there's a tool call
    if (choice?.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === "add_trade") {
        const tradeData = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({
          type: "tool_call",
          tool: "add_trade",
          data: tradeData,
          message: choice.message.content || `I'll add this trade: ${tradeData.pair} ${tradeData.direction} with result $${tradeData.result}`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular text response
    return new Response(JSON.stringify({
      type: "message",
      message: choice?.message?.content || "I couldn't generate a response."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Trading assistant error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
