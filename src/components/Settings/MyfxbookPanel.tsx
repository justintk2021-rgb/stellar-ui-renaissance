import { useState } from "react";
import { useMyfxbook } from "@/hooks/useMyfxbook";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  RefreshCw,
  Unlink,
  XCircle,
} from "lucide-react";

export function MyfxbookPanel() {
  const {
    connection,
    accounts,
    loading,
    syncing,
    connect,
    selectAccount,
    sync,
    disconnect,
  } = useMyfxbook();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await connect(email, password);
      if (result) {
        setEmail("");
        setPassword("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected — show login form
  if (!connection || connection.connection_status !== "connected") {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="w-4 h-4 text-primary" />
              Connect Myfxbook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-5">
              Sign in with your Myfxbook account to import trade history,
              equity, and performance into your dashboard. Your password is
              stored encrypted and only used to refresh the session.
            </p>
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfx-email">Email</Label>
                <Input
                  id="mfx-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfx-password">Password</Label>
                <div className="relative">
                  <Input
                    id="mfx-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {connection?.last_error && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{connection.last_error}</span>
                </div>
              )}
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Link2 className="w-4 h-4 mr-2" />}
                Connect Myfxbook
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connected — show account list, status, sync controls
  const activeAccountId = connection.active_account_id;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Myfxbook Connected
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {connection.login}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {connection.connection_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat
              label="Balance"
              value={fmt(connection.account_balance, connection.account_currency)}
            />
            <Stat
              label="Equity"
              value={fmt(connection.account_equity, connection.account_currency)}
            />
            <Stat
              label="Last sync"
              value={connection.last_connected_at
                ? new Date(connection.last_connected_at).toLocaleString()
                : "—"}
            />
          </div>

          <Separator />

          {/* Account selector */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Active account
            </Label>
            {accounts.length === 0
              ? (
                <p className="text-sm text-muted-foreground">
                  No accounts found on this Myfxbook profile.
                </p>
              )
              : (
                <Select
                  value={activeAccountId || ""}
                  onValueChange={(v) => selectAccount(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Myfxbook account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem
                        key={a.id}
                        value={a.account_id_external}
                      >
                        {a.account_name || `Account ${a.acc_num}`}{" "}
                        <span className="text-muted-foreground">
                          (#{a.acc_num})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            <p className="text-[11px] text-muted-foreground">
              Only the active account is synced into your trade journal.
            </p>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={sync}
              disabled={syncing || !activeAccountId}
              size="sm"
            >
              {syncing
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync trades
            </Button>
            <Button onClick={disconnect} size="sm" variant="outline">
              <Unlink className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-lg p-3">
            <Activity className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Synced trades flow into your dashboard automatically — Recent
              Trades, the Calendar, the Intelligence Map and all stat cards
              will pick them up. Switch your account in the dashboard
              selector to view them.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}

function fmt(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null) return "—";
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${cur} ${value.toFixed(2)}`;
  }
}
