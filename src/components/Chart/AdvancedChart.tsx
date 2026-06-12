import { useEffect, useRef, useState } from "react";
import { LightweightChart } from "./LightweightChart";
import { createChartDatafeed } from "@/lib/chartDatafeed";
import { createChartStorageAdapter } from "@/lib/chartStorage";
import { supabase } from "@/integrations/supabase/client";

/**
 * TradingView Advanced Charts (self-hosted Charting Library) wrapper.
 *
 * Setup once the library license is approved:
 *   1. Clone TradingView's private `charting_library` repo.
 *   2. Copy its `charting_library/` folder into `public/charting_library/`.
 *   3. Done — this component detects it and switches over automatically.
 *
 * Until then it falls back to the free TradingView embed (LightweightChart),
 * which has no drawing persistence.
 */

const LIBRARY_SCRIPT = "/charting_library/charting_library.standalone.js";

type LibraryStatus = "checking" | "available" | "missing";

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => { remove: () => void };
    };
  }
}

function loadLibraryScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.TradingView?.widget) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = LIBRARY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.TradingView?.widget));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function AdvancedChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove: () => void } | null>(null);
  const [status, setStatus] = useState<LibraryStatus>("checking");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, available] = await Promise.all([
        supabase.auth.getUser(),
        loadLibraryScript(),
      ]);
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      setStatus(available ? "available" : "missing");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "available" || !containerRef.current || !window.TradingView) return;

    const widget = new window.TradingView.widget({
      container: containerRef.current,
      library_path: "/charting_library/",
      symbol: localStorage.getItem("chart-symbol") || "BTCUSD",
      interval: "15",
      autosize: true,
      locale: "en",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      datafeed: createChartDatafeed(),
      // Per-user persistence (drawings, layouts, templates) via Supabase
      save_load_adapter: userId ? createChartStorageAdapter(userId) : undefined,
      auto_save_delay: 5,
      load_last_chart: true,
      client_id: "nsync-journal",
      user_id: userId ?? "anonymous",
      enabled_features: [
        "saveload_separate_drawings_storage",
        "side_toolbar_in_fullscreen_mode",
        "header_in_fullscreen_mode",
      ],
      disabled_features: ["popup_hints"],
    });
    widgetRef.current = widget;

    return () => {
      try {
        widgetRef.current?.remove();
      } catch {
        /* widget already disposed */
      }
      widgetRef.current = null;
    };
  }, [status, userId]);

  if (status === "checking") {
    return (
      <div
        className="rounded-lg border border-border/50 bg-card/30 animate-pulse"
        style={{ height: "calc(100vh - 140px)" }}
      />
    );
  }

  // Library not installed yet — fall back to the free embed
  if (status === "missing") {
    return <LightweightChart />;
  }

  return (
    <div className="animate-fade-in" style={{ height: "calc(100vh - 140px)" }}>
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden border border-border/50"
      />
    </div>
  );
}
