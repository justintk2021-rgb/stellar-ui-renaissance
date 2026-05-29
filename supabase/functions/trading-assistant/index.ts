import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { APP_KNOWLEDGE, formatUserContext } from "./appKnowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `${APP_KNOWLEDGE}

## Trade logging tool
When a user wants to add a trade, use the add_trade function. Extract:
- date: YYYY-MM-DD (default today)
- pair: symbol (EURUSD, BTCUSD, etc.)
- direction: "Long" or "Short"
- result: P&L in dollars (+ profit, - loss)
- session: optional (London, New York, Asian)
- notes: optional

Be conversational, data-driven, and actionable.`;

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

    const { messages, userContext, tradeContext } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const contextPayload = userContext ?? tradeContext;
    const contextPrompt = `${SYSTEM_PROMPT}\n\n${formatUserContext(contextPayload)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
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
