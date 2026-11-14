import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForTokens } from "@/lib/spotify";

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!code || !state) {
      setError("Missing authorization code from Spotify.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await exchangeCodeForTokens(code, state);
        if (!cancelled) navigate("/dashboard", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not complete Spotify login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md space-y-3 rounded-2xl border border-border/40 bg-card/50 p-6 text-center backdrop-blur-md">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Spotify connection failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => navigate("/dashboard", { replace: true })}
            >
              Back to dashboard
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            <p className="text-sm text-muted-foreground">Connecting Spotify…</p>
          </>
        )}
      </div>
    </div>
  );
}
