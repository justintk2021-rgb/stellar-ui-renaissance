import { useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Copy, Loader2, Plus, RefreshCw, Unlink, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMetaTrader } from '@/hooks/useMetaTrader';

export function MetaTraderManagement() {
  const {
    connections,
    connection,
    activeConnectionId,
    selectConnection,
    latestBridgeKey,
    clearLatestBridgeKey,
    positions,
    orders,
    history,
    summary,
    bridgeStatus,
    loading,
    loadingData,
    createConnection,
    refresh,
    disconnect,
  } = useMetaTrader();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [brokerName, setBrokerName] = useState('MetaTrader 5');
  const [server, setServer] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const bridgeOnline = bridgeStatus?.status === 'online';

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const handleCreateConnection = async () => {
    if (!login.trim() || !password || !server.trim()) {
      toast.error('MT5 login, password, and server are required');
      return;
    }

    setCreating(true);
    try {
      await createConnection({
        brokerName: brokerName.trim() || 'MetaTrader 5',
        server: server.trim(),
        login: login.trim(),
        password,
      });
      setPassword('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (value: number | null | undefined, currency = connection?.account_currency || 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0));
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const statusBadge = () => {
    if (bridgeOnline) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Bridge Online</Badge>;
    }
    if (bridgeStatus?.status === 'pending' || connection?.connection_status === 'connecting') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Waiting for Bridge</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Bridge Offline</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const showEmptyState = connections.length === 0 || showCreateForm;

  if (showEmptyState) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {connections.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
              Back to MT5 connection
            </Button>
          </div>
        )}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Connect MT5 Broker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the user's MT5 broker credentials here. The local bridge will use them to pull trades from MT5.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Broker Name</Label>
                <Input value={brokerName} onChange={(event) => setBrokerName(event.target.value)} showNumberControls={false} />
              </div>
              <div className="space-y-2">
                <Label>MT5 Server</Label>
                <Input placeholder="YourBroker-Server" value={server} onChange={(event) => setServer(event.target.value)} showNumberControls={false} />
              </div>
              <div className="space-y-2">
                <Label>MT5 Login</Label>
                <Input placeholder="12345678" value={login} onChange={(event) => setLogin(event.target.value)} showNumberControls={false} />
              </div>
              <div className="space-y-2">
                <Label>MT5 Password</Label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} showNumberControls={false} />
              </div>
            </div>
            <Button onClick={handleCreateConnection} disabled={creating} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Save Credentials & Create Bridge Key
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!connection) {
    return <div className="py-12 text-center text-muted-foreground">Select an MT5 connection.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={activeConnectionId || ''} onValueChange={selectConnection}>
          <SelectTrigger className="w-[280px] bg-background/50">
            <SelectValue placeholder="Select MT5 connection" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.broker_name} · {item.login}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add MT5
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loadingData}>
            {loadingData ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={disconnect}>
            <Unlink className="w-4 h-4 mr-1" /> Disconnect
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {statusBadge()}
              <span className="text-sm text-muted-foreground">
                {connection.broker_name} · {connection.server} · {connection.login}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Last heartbeat: {formatDate(bridgeStatus?.last_heartbeat_at)}
            </span>
          </div>
          {bridgeStatus?.last_error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-300">
              {bridgeStatus.last_error}
            </div>
          )}
        </CardContent>
      </Card>

      {latestBridgeKey && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Bridge Pairing Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this key into `bridges/mt5/.env`. The user's MT5 credentials were saved from the website and will be fetched by the paired bridge.
            </p>
            <div className="flex gap-2">
              <Input value={latestBridgeKey} readOnly className="font-mono text-xs" showNumberControls={false} />
              <Button variant="outline" onClick={() => copyText(latestBridgeKey, 'Bridge key')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(supabaseUrl, 'Supabase URL')}>Copy Supabase URL</Button>
              <Button variant="outline" size="sm" onClick={() => copyText(anonKey, 'Anon key')}>Copy Anon Key</Button>
            </div>
            <Button variant="ghost" size="sm" onClick={clearLatestBridgeKey}>Hide key</Button>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Balance" value={formatCurrency(summary.balance)} />
          <MetricCard label="Equity" value={formatCurrency(summary.equity)} />
          <MetricCard label="Floating P/L" value={formatCurrency(summary.floatingPl)} valueClass={summary.floatingPl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          <MetricCard label="Open Positions" value={String(summary.openPositions)} />
        </div>
      )}

      <Tabs defaultValue="positions">
        <TabsList className="w-full justify-start flex-wrap">
          <TabsTrigger value="positions">Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Open</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium">{position.symbol}</TableCell>
                      <TableCell>{position.side}</TableCell>
                      <TableCell>{position.volume}</TableCell>
                      <TableCell>{position.open_price}</TableCell>
                      <TableCell className={position.floating_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(position.floating_pl)}</TableCell>
                      <TableCell className="text-xs">{formatDate(position.open_time)}</TableCell>
                    </TableRow>
                  ))}
                  {positions.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No open positions</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.symbol}</TableCell>
                      <TableCell>{order.order_type}</TableCell>
                      <TableCell>{order.side}</TableCell>
                      <TableCell>{order.size}</TableCell>
                      <TableCell>{order.entry_price || '-'}</TableCell>
                      <TableCell>{order.status}</TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending orders</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>{trade.side}</TableCell>
                      <TableCell>{trade.size}</TableCell>
                      <TableCell>{trade.entry_price}</TableCell>
                      <TableCell>{trade.exit_price || '-'}</TableCell>
                      <TableCell className={trade.realized_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(trade.realized_pl)}</TableCell>
                      <TableCell className="text-xs">{formatDate(trade.closed_at)}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No MT5 history synced yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm font-semibold ${valueClass || ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
