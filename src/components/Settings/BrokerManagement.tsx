import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBrokerConnections } from '@/hooks/useBrokerConnections';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { toast } from 'sonner';
import { 
  Link2, Unlink, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, Eye, EyeOff, DollarSign, Activity, HelpCircle, ExternalLink
} from 'lucide-react';

const PLATFORMS = [
  { value: 'mt5', label: 'MetaTrader 5' },
  { value: 'mt4', label: 'MetaTrader 4' },
  { value: 'ctrader', label: 'cTrader' },
  { value: 'tradelocker', label: 'TradeLocker' },
];

interface BrokerManagementProps {
  userId?: string;
}

export function BrokerManagement({ userId }: BrokerManagementProps) {
  const { connections, positions, loading, connectBroker, disconnectBroker, checkStatus, refreshPositions, syncTrades, fetchPositions } = useBrokerConnections();
  const { accounts } = useTradingAccounts(userId);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [positionsDialogOpen, setPositionsDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  
  // Form state
  const [platform, setPlatform] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [server, setServer] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [metaapiAccountId, setMetaapiAccountId] = useState('');
  const [useAdvanced, setUseAdvanced] = useState(false);

  // Check connecting accounts periodically
  useEffect(() => {
    const connectingAccounts = connections.filter(c => c.connection_status === 'connecting');
    if (connectingAccounts.length === 0) return;

    const interval = setInterval(() => {
      connectingAccounts.forEach(c => checkStatus(c.id));
    }, 5000);

    return () => clearInterval(interval);
  }, [connections, checkStatus]);

  const resetForm = () => {
    setPlatform('');
    setBrokerName('');
    setServer('');
    setLogin('');
    setPassword('');
    setMetaapiAccountId('');
    setUseAdvanced(false);
  };

  const handleConnect = async () => {
    if (!platform) {
      toast.error('Please select a platform');
      return;
    }

    // TradeLocker validation
    if (platform === 'tradelocker') {
      if (!login || !password || !server) {
        toast.error('Please fill in all fields');
        return;
      }
    } else {
      // MT4/MT5/cTrader - require credentials OR MetaAPI Account ID
      if (useAdvanced && !metaapiAccountId.trim()) {
        toast.error('Please enter your MetaAPI Account ID');
        return;
      }
      if (!useAdvanced && (!login || !password || !server)) {
        toast.error('Please fill in all broker credentials');
        return;
      }
    }

    setIsConnecting(true);
    
    const result = await connectBroker(
      platform,
      brokerName || (platform === 'tradelocker' ? 'TradeLocker' : platform.toUpperCase()),
      server || 'metaapi',
      login || 'metaapi',
      password || 'metaapi',
      metaapiAccountId || undefined
    );

    setIsConnecting(false);

    // Handle requiresAccountId response - just show error, form already shows Account ID input
    if (result.requiresAccountId) {
      toast.error('Please enter a valid MetaAPI Account ID', { duration: 6000 });
      return;
    }

    // Success - close dialog and reset
    if (result.success) {
      resetForm();
      setDialogOpen(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    const defaultAccount = accounts.find(a => a.is_default);
    await syncTrades(connectionId, defaultAccount?.id);
    setSyncingId(null);
  };

  const handleRefreshPositions = async (connectionId: string) => {
    setRefreshingId(connectionId);
    await refreshPositions(connectionId);
    setRefreshingId(null);
  };

  const handleViewPositions = async (connectionId: string) => {
    await fetchPositions(connectionId);
    setSelectedConnectionId(connectionId);
    setPositionsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Disconnected</Badge>;
    }
  };

  const formatCurrency = (value: number | null, currency = 'USD') => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const selectedPositions = positions.filter(p => p.broker_connection_id === selectedConnectionId);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Broker Connections
            </CardTitle>
            <CardDescription className="mt-1">
              Connect your trading accounts to automatically sync trades
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Link2 className="w-4 h-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Connect Trading Account</DialogTitle>
                <DialogDescription>
                  Enter your broker credentials to connect
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Platform Selection */}
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* TradeLocker Form */}
                {platform === 'tradelocker' && (
                  <>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={login}
                        onChange={(e) => setLogin(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Server</Label>
                      <Select value={server} onValueChange={setServer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select server" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demo.tradelocker.com">Demo Server</SelectItem>
                          <SelectItem value="live.tradelocker.com">Live Server</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* MT4/MT5/cTrader Form - Direct credentials for seamless experience */}
                {(platform === 'mt4' || platform === 'mt5' || platform === 'ctrader') && (
                  <>
                    {!useAdvanced ? (
                      <>
                        <div className="space-y-2">
                          <Label>Broker Name</Label>
                          <Input
                            placeholder="e.g., IC Markets, FTMO, Deriv"
                            value={brokerName}
                            onChange={(e) => setBrokerName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Server</Label>
                          <Input
                            placeholder="e.g., ICMarketsSC-Live01"
                            value={server}
                            onChange={(e) => setServer(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Find this in your broker terminal: File → Login to Trade Account
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Login / Account Number</Label>
                          <Input
                            placeholder="e.g., 12345678"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Password (Investor/Read-only recommended)</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Use your investor password for read-only access
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setUseAdvanced(true)}
                        >
                          Already have a MetaAPI account? Use Account ID →
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>MetaAPI Account ID</Label>
                          <Input
                            placeholder="e.g., 12345678-abcd-1234-efgh-..."
                            value={metaapiAccountId}
                            onChange={(e) => setMetaapiAccountId(e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setUseAdvanced(false)}
                        >
                          ← Use broker credentials instead
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { resetForm(); setDialogOpen(false); }}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No broker accounts connected</p>
            <p className="text-sm mt-1">Connect your trading account to auto-sync trades</p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => (
              <div key={conn.id} className="border rounded-lg p-4 space-y-3 bg-background/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{conn.broker_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {conn.platform.toUpperCase()} • {conn.login}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(conn.connection_status)}
                </div>
                
                {conn.connection_status === 'connected' && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Balance</div>
                        <div className="font-medium">{formatCurrency(conn.account_balance, conn.account_currency)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Equity</div>
                        <div className="font-medium">{formatCurrency(conn.account_equity, conn.account_currency)}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {conn.last_error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
                    {conn.last_error}
                  </div>
                )}
                
                <Separator />
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefreshPositions(conn.id)}
                    disabled={conn.connection_status !== 'connected' || refreshingId === conn.id}
                  >
                    {refreshingId === conn.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(conn.id)}
                    disabled={conn.connection_status !== 'connected' || syncingId === conn.id}
                  >
                    {syncingId === conn.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Sync Trades
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewPositions(conn.id)}
                    disabled={conn.connection_status !== 'connected'}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Positions
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => disconnectBroker(conn.id)}
                  >
                    <Unlink className="w-4 h-4 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Positions Dialog */}
        <Dialog open={positionsDialogOpen} onOpenChange={setPositionsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Open Positions</DialogTitle>
              <DialogDescription>Current open positions for this account</DialogDescription>
            </DialogHeader>
            {selectedPositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No open positions</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Open Price</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={pos.type === 'buy' ? 'default' : 'secondary'}>
                          {pos.type === 'buy' ? (
                            <><TrendingUp className="w-3 h-3 mr-1" /> Buy</>
                          ) : (
                            <><TrendingDown className="w-3 h-3 mr-1" /> Sell</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{pos.volume}</TableCell>
                      <TableCell className="text-right font-mono">{pos.open_price}</TableCell>
                      <TableCell className={`text-right font-mono ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(pos.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
