import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTradeLocker } from '@/hooks/useTradeLocker';
import { MyfxbookPanel } from './MyfxbookPanel';
import { toast } from 'sonner';
import {
  Link2, Unlink, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, Eye, EyeOff, DollarSign, Activity, Wallet,
  BarChart3, Clock, ShieldCheck, ArrowUpRight, ArrowDownRight, X, Pencil, Send, Plus, ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface BrokerManagementProps {
  userId?: string;
}

export function BrokerManagement({ userId }: BrokerManagementProps) {
  const [activePlatform, setActivePlatform] = useState<string>('tradelocker');

  const {
    connections, connection, activeConnectionId, selectConnection,
    accounts, positions, orders, history, summary,
    loading, syncing,
    connect, selectAccount, sync, disconnect, reconnect,
    placeOrder, closePosition, modifyPosition, cancelOrder, modifyOrder,
    updateSyncSettings, runDiagnostic, fetchSyncLogs,
  } = useTradeLocker();

  const [diagnosticResults, setDiagnosticResults] = useState<any[] | null>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Connection form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [environment, setEnvironment] = useState<string>('demo');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Reconnect
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [reconnectEmail, setReconnectEmail] = useState('');
  const [reconnectPassword, setReconnectPassword] = useState('');

  // Modify dialogs
  const [modifyPosOpen, setModifyPosOpen] = useState(false);
  const [modifyPosId, setModifyPosId] = useState('');
  const [modifySl, setModifySl] = useState('');
  const [modifyTp, setModifyTp] = useState('');

  const [modifyOrdOpen, setModifyOrdOpen] = useState(false);
  const [modifyOrdId, setModifyOrdId] = useState('');
  const [modifyOrdSl, setModifyOrdSl] = useState('');
  const [modifyOrdTp, setModifyOrdTp] = useState('');
  const [modifyOrdPrice, setModifyOrdPrice] = useState('');

  // Trade execution
  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeSide, setTradeSide] = useState<string>('buy');
  const [tradeType, setTradeType] = useState<string>('market');
  const [tradeQty, setTradeQty] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeSl, setTradeSl] = useState('');
  const [tradeTp, setTradeTp] = useState('');
  const [tradableInstrumentId, setTradableInstrumentId] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const handleConnect = async () => {
    if (!email || !password || !server) {
      toast.error('Please fill all fields');
      return;
    }
    setIsConnecting(true);
    try {
      await connect(email, password, server, environment);
      setEmail('');
      setPassword('');
      setServer('');
      setShowConnectForm(false);
    } catch {
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    if (!reconnectEmail || !reconnectPassword) return;
    await reconnect(reconnectEmail, reconnectPassword);
    setReconnectOpen(false);
    setReconnectEmail('');
    setReconnectPassword('');
  };

  const handlePlaceOrder = async () => {
    if (!tradeSymbol || !tradeQty || !tradableInstrumentId) {
      toast.error('Fill symbol, instrument ID, and quantity');
      return;
    }
    setIsPlacing(true);
    try {
      await placeOrder({
        symbol: tradeSymbol,
        side: tradeSide,
        type: tradeType,
        qty: parseFloat(tradeQty),
        price: tradePrice ? parseFloat(tradePrice) : undefined,
        stopLoss: tradeSl ? parseFloat(tradeSl) : undefined,
        takeProfit: tradeTp ? parseFloat(tradeTp) : undefined,
        tradableInstrumentId: parseInt(tradableInstrumentId),
      });
      setTradeSymbol('');
      setTradeQty('');
      setTradePrice('');
      setTradeSl('');
      setTradeTp('');
      setTradableInstrumentId('');
    } catch {
    } finally {
      setIsPlacing(false);
    }
  };

  const formatCurrency = (val: number | null | undefined, currency = 'USD') => {
    if (val === null || val === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'expired':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
      default:
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Disconnected</Badge>;
    }
  };

  const renderConnectForm = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Connect TradeLocker
            </div>
            {connections.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowConnectForm(false)}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Server Name</Label>
              <Input placeholder="e.g. OSP-DEMO" value={server} onChange={(e) => setServer(e.target.value)} showNumberControls={false} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} showNumberControls={false} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                showNumberControls={false}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderConnectionSwitcher = () => {
    if (connections.length === 0) return null;

    return (
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[220px] justify-between bg-background/50 border-border/50">
              <div className="flex items-center gap-2 truncate">
                <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate text-sm">
                    {connection?.broker_name || 'Select Connection'} · {connection?.server}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {connection?.environment?.toUpperCase()} · {connection?.login}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Broker Connections ({connections.length})
            </DropdownMenuLabel>
            {connections.map((conn) => (
              <DropdownMenuItem
                key={conn.id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => selectConnection(conn.id)}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">{conn.broker_name} · {conn.server}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {conn.environment?.toUpperCase()} · {conn.login}
                    {conn.account_balance != null && ` · ${formatCurrency(conn.account_balance, conn.account_currency || 'USD')}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(conn.connection_status)}
                  {activeConnectionId === conn.id && (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-primary"
              onClick={() => setShowConnectForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderTradeLocker = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );
    }

    // Show connect form if no connections exist, or if user requested it
    if (connections.length === 0 || showConnectForm) {
      return renderConnectForm();
    }

    if (!connection) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          Select a connection to manage.
        </div>
      );
    }

    // Account selection (connection exists but no active account)
    if (!connection.active_account_id && accounts.length > 0) {
      return (
        <div className="space-y-6">
          {renderConnectionSwitcher()}
          <div className="max-w-2xl mx-auto">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Select Trading Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {accounts.map((acc) => (
                  <Button
                    key={acc.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    onClick={() => selectAccount(acc.account_id_external, acc.acc_num)}
                  >
                    <span className="font-medium">{acc.account_name || `Account ${acc.acc_num}`}</span>
                    <Badge variant="secondary">accNum: {acc.acc_num}</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // Full broker management
    const isExpired = connection.connection_status === 'expired';

    return (
      <div className="space-y-6">
        {/* Connection Switcher */}
        {renderConnectionSwitcher()}

        {/* Top Status Bar */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {getStatusBadge(connection.connection_status)}
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">TradeLocker</span>
                  {' · '}
                  <Badge variant="outline" className="text-xs">{connection.environment?.toUpperCase()}</Badge>
                  {' · '}
                  {connection.server}
                </div>
                {connection.last_connected_at && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last sync: {formatDate(connection.last_connected_at)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={sync} disabled={syncing || isExpired}>
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Sync
                </Button>
                {isExpired && (
                  <Button size="sm" variant="default" onClick={() => setReconnectOpen(true)}>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Reconnect
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={disconnect}>
                  <Unlink className="w-4 h-4 mr-1" /> Disconnect
                </Button>
              </div>
            </div>
            {isExpired && (
              <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Session expired. Please reconnect to continue syncing.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Auto-Sync</Label>
                  <Switch
                    checked={connection.auto_sync_enabled}
                    onCheckedChange={(checked) => updateSyncSettings(checked, connection.sync_interval_seconds)}
                  />
                </div>
                {connection.auto_sync_enabled && (
                  <Select
                    value={String(connection.sync_interval_seconds)}
                    onValueChange={(v) => updateSyncSettings(true, parseInt(v))}
                  >
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Every 30s</SelectItem>
                      <SelectItem value="60">Every 1 min</SelectItem>
                      <SelectItem value="300">Every 5 min</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              {connection.auto_sync_enabled && connection.sync_interval_seconds <= 30 && (
                <span className="text-xs text-amber-400">⚠ Frequent syncing may hit rate limits</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DashCard icon={<Wallet className="w-5 h-5" />} label="Balance" value={formatCurrency(summary.balance)} />
            <DashCard icon={<Activity className="w-5 h-5" />} label="Equity" value={formatCurrency(summary.equity)} />
            <DashCard icon={<DollarSign className="w-5 h-5" />} label="Free Margin" value={formatCurrency(summary.freeMargin)} />
            <DashCard
              icon={summary.floatingPl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              label="Floating P/L"
              value={formatCurrency(summary.floatingPl)}
              valueClass={summary.floatingPl >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <DashCard icon={<BarChart3 className="w-5 h-5" />} label="Margin Used" value={formatCurrency(summary.marginUsed)} />
            <DashCard icon={<Activity className="w-5 h-5" />} label="Open Positions" value={String(summary.openPositions)} />
            <DashCard icon={<Clock className="w-5 h-5" />} label="Pending Orders" value={String(summary.pendingOrders)} />
            <DashCard icon={<ShieldCheck className="w-5 h-5" />} label="Connection" value={connection.connection_status || 'unknown'} />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="w-full justify-start flex-wrap">
            <TabsTrigger value="positions">Positions ({positions.length})</TabsTrigger>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
            <TabsTrigger value="trade">Place Trade</TabsTrigger>
            <TabsTrigger value="debug" onClick={async () => {
              if (!showDebug) {
                setShowDebug(true);
                const logs = await fetchSyncLogs();
                setSyncLogs(logs);
              }
            }}>Debug / Logs</TabsTrigger>
          </TabsList>

          {/* POSITIONS */}
          <TabsContent value="positions">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-0">
                {positions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No open positions</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Entry</TableHead>
                          <TableHead>SL</TableHead>
                          <TableHead>TP</TableHead>
                          <TableHead>P/L</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((pos) => (
                          <TableRow key={pos.id}>
                            <TableCell className="font-medium">{pos.symbol}</TableCell>
                            <TableCell>
                              <Badge className={pos.side === 'buy' || pos.type?.includes('BUY') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                                {pos.side || (pos.type?.includes('BUY') ? 'Buy' : 'Sell')}
                              </Badge>
                            </TableCell>
                            <TableCell>{pos.volume}</TableCell>
                            <TableCell>{pos.open_price}</TableCell>
                            <TableCell>{pos.stop_loss || '-'}</TableCell>
                            <TableCell>{pos.take_profit || '-'}</TableCell>
                            <TableCell className={pos.floating_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {formatCurrency(pos.floating_pl)}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(pos.open_time)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setModifyPosId(pos.position_id);
                                    setModifySl(pos.stop_loss ? String(pos.stop_loss) : '');
                                    setModifyTp(pos.take_profit ? String(pos.take_profit) : '');
                                    setModifyPosOpen(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-400 hover:text-red-300"
                                  onClick={() => closePosition(pos.position_id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-0">
                {orders.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No pending orders</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>SL</TableHead>
                          <TableHead>TP</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((ord) => (
                          <TableRow key={ord.id}>
                            <TableCell className="font-medium">{ord.symbol}</TableCell>
                            <TableCell><Badge variant="outline">{ord.order_type}</Badge></TableCell>
                            <TableCell>
                              <Badge className={ord.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                                {ord.side}
                              </Badge>
                            </TableCell>
                            <TableCell>{ord.size}</TableCell>
                            <TableCell>{ord.entry_price || '-'}</TableCell>
                            <TableCell>{ord.stop_loss || '-'}</TableCell>
                            <TableCell>{ord.take_profit || '-'}</TableCell>
                            <TableCell><Badge variant="secondary">{ord.status}</Badge></TableCell>
                            <TableCell className="text-xs">{formatDate(ord.created_broker_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setModifyOrdId(ord.broker_order_id);
                                    setModifyOrdSl(ord.stop_loss ? String(ord.stop_loss) : '');
                                    setModifyOrdTp(ord.take_profit ? String(ord.take_profit) : '');
                                    setModifyOrdPrice(ord.entry_price ? String(ord.entry_price) : '');
                                    setModifyOrdOpen(true);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-400 hover:text-red-300"
                                  onClick={() => cancelOrder(ord.broker_order_id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No trade history yet. Sync to import.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Entry</TableHead>
                          <TableHead>Exit</TableHead>
                          <TableHead>P/L</TableHead>
                          <TableHead>Fees</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Closed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.symbol}</TableCell>
                            <TableCell>
                              <Badge className={t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                                {t.side}
                              </Badge>
                            </TableCell>
                            <TableCell>{t.size}</TableCell>
                            <TableCell>{t.entry_price}</TableCell>
                            <TableCell>{t.exit_price || '-'}</TableCell>
                            <TableCell className={t.realized_pl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {formatCurrency(t.realized_pl)}
                            </TableCell>
                            <TableCell>{formatCurrency(t.fees)}</TableCell>
                            <TableCell className="text-xs">{formatDate(t.opened_at)}</TableCell>
                            <TableCell className="text-xs">{formatDate(t.closed_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRADE EXECUTION */}
          <TabsContent value="trade">
            <Card className="border-border/50 bg-card/80">
              <CardContent className="py-6 space-y-4 max-w-md">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input placeholder="EURUSD" value={tradeSymbol} onChange={(e) => setTradeSymbol(e.target.value)} showNumberControls={false} />
                  </div>
                  <div className="space-y-2">
                    <Label>Instrument ID</Label>
                    <Input placeholder="Tradable ID" value={tradableInstrumentId} onChange={(e) => setTradableInstrumentId(e.target.value)} showNumberControls={false} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Side</Label>
                    <Select value={tradeSide} onValueChange={setTradeSide}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={tradeType} onValueChange={setTradeType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="limit">Limit</SelectItem>
                        <SelectItem value="stop">Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" placeholder="0.01" value={tradeQty} onChange={(e) => setTradeQty(e.target.value)} />
                  </div>
                  {tradeType !== 'market' && (
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input type="number" placeholder="Price" value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stop Loss</Label>
                    <Input type="number" placeholder="Optional" value={tradeSl} onChange={(e) => setTradeSl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Take Profit</Label>
                    <Input type="number" placeholder="Optional" value={tradeTp} onChange={(e) => setTradeTp(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handlePlaceOrder} disabled={isPlacing || isExpired} className="w-full">
                  {isPlacing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Place Order
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEBUG / LOGS */}
          <TabsContent value="debug">
            <Card className="border-border/50 bg-card/80">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Sync Diagnostic</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningDiagnostic}
                    onClick={async () => {
                      setRunningDiagnostic(true);
                      const results = await runDiagnostic();
                      setDiagnosticResults(results);
                      setRunningDiagnostic(false);
                    }}
                  >
                    {runningDiagnostic ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Activity className="w-4 h-4 mr-1" />}
                    Run Diagnostic
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {diagnosticResults && (
                  <div className="space-y-2">
                    {diagnosticResults.map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded border border-border/50 bg-background/50">
                        {r.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{r.step}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Recent Sync Logs</h4>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const logs = await fetchSyncLogs();
                    setSyncLogs(logs);
                  }}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
                {syncLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No sync logs yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Records</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {syncLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">{log.sync_type}</TableCell>
                            <TableCell>
                              <Badge className={log.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{log.records_processed || 0}</TableCell>
                            <TableCell className="text-xs">{formatDate(log.started_at)}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{log.error_message || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modify Position Dialog */}
        <Dialog open={modifyPosOpen} onOpenChange={setModifyPosOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modify Position</DialogTitle>
              <DialogDescription>Update stop loss and take profit</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Stop Loss</Label>
                <Input type="number" value={modifySl} onChange={(e) => setModifySl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Take Profit</Label>
                <Input type="number" value={modifyTp} onChange={(e) => setModifyTp(e.target.value)} />
              </div>
              <Button onClick={async () => {
                await modifyPosition(modifyPosId, modifySl ? parseFloat(modifySl) : undefined, modifyTp ? parseFloat(modifyTp) : undefined);
                setModifyPosOpen(false);
              }} className="w-full">Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modify Order Dialog */}
        <Dialog open={modifyOrdOpen} onOpenChange={setModifyOrdOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modify Order</DialogTitle>
              <DialogDescription>Update order parameters</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" value={modifyOrdPrice} onChange={(e) => setModifyOrdPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Stop Loss</Label>
                <Input type="number" value={modifyOrdSl} onChange={(e) => setModifyOrdSl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Take Profit</Label>
                <Input type="number" value={modifyOrdTp} onChange={(e) => setModifyOrdTp(e.target.value)} />
              </div>
              <Button onClick={async () => {
                await modifyOrder(modifyOrdId, {
                  price: modifyOrdPrice ? parseFloat(modifyOrdPrice) : undefined,
                  stopLoss: modifyOrdSl ? parseFloat(modifyOrdSl) : undefined,
                  takeProfit: modifyOrdTp ? parseFloat(modifyOrdTp) : undefined,
                });
                setModifyOrdOpen(false);
              }} className="w-full">Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reconnect Dialog */}
        <Dialog open={reconnectOpen} onOpenChange={setReconnectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconnect to TradeLocker</DialogTitle>
              <DialogDescription>Enter your credentials to re-authenticate</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={reconnectEmail} onChange={(e) => setReconnectEmail(e.target.value)} showNumberControls={false} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={reconnectPassword} onChange={(e) => setReconnectPassword(e.target.value)} showNumberControls={false} />
              </div>
              <Button onClick={handleReconnect} className="w-full">Reconnect</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const renderMT5 = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Activity className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">MetaTrader 5</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            MT5 integration coming soon. Requires a self-hosted Python bridge on a VPS for direct API access.
          </p>
          <Badge variant="secondary">Coming Soon</Badge>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activePlatform} onValueChange={setActivePlatform}>
        <TabsList>
          <TabsTrigger value="tradelocker">TradeLocker</TabsTrigger>
          <TabsTrigger value="mt5">MetaTrader 5</TabsTrigger>
        </TabsList>
        <TabsContent value="tradelocker" className="mt-6">
          {renderTradeLocker()}
        </TabsContent>
        <TabsContent value="mt5" className="mt-6">
          {renderMT5()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashCard({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="py-4 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-sm font-semibold ${valueClass || ''}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
