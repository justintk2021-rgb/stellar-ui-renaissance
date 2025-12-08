import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBrokerConnections } from '@/hooks/useBrokerConnections';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { supabase } from '@/integrations/supabase/client';
import { 
  Link2, Unlink, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, TrendingDown, Eye, EyeOff, DollarSign, Activity,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PLATFORMS = [
  { value: 'mt5', label: 'MetaTrader 5' },
  { value: 'mt4', label: 'MetaTrader 4' },
  { value: 'tradelocker', label: 'Trade Locker' },
  { value: 'ctrader', label: 'cTrader' },
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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({ platform: '', brokerName: '', server: '', login: '', password: '' });

  useEffect(() => {
    const connectingAccounts = connections.filter(c => c.connection_status === 'connecting');
    if (connectingAccounts.length > 0) {
      const interval = setInterval(() => { connectingAccounts.forEach(c => checkStatus(c.id)); }, 5000);
      return () => clearInterval(interval);
    }
  }, [connections, checkStatus]);

  const handleConnect = async () => {
    if (!formData.platform || !formData.brokerName || !formData.server || !formData.login || !formData.password) return;
    setIsConnecting(true);
    try {
      await connectBroker(formData.platform, formData.brokerName, formData.server, formData.login, formData.password);
      setDialogOpen(false);
      setFormData({ platform: '', brokerName: '', server: '', login: '', password: '' });
    } finally { setIsConnecting(false); }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try { const defaultAccount = accounts.find(a => a.is_default); await syncTrades(connectionId, defaultAccount?.id); } 
    finally { setSyncingId(null); }
  };

  const handleRefreshPositions = async (connectionId: string) => {
    setRefreshingId(connectionId);
    try { await refreshPositions(connectionId); } finally { setRefreshingId(null); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected': return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'connecting': return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'error': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default: return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> Disconnected</Badge>;
    }
  };

  const formatCurrency = (value: number | null, currency: string = 'USD') => value === null ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Broker Connections</CardTitle><CardDescription>Connect your trading accounts for real-time syncing</CardDescription></div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Link2 className="w-4 h-4 mr-2" />Add Account</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Connect Trading Account</DialogTitle><DialogDescription>Enter your broker credentials to connect.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Platform</Label><Select value={formData.platform} onValueChange={(v) => setFormData(f => ({ ...f, platform: v }))}><SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Broker Name</Label><Input placeholder="e.g., ICMarkets" value={formData.brokerName} onChange={(e) => setFormData(f => ({ ...f, brokerName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Server</Label><Input placeholder="e.g., ICMarketsSC-Demo" value={formData.server} onChange={(e) => setFormData(f => ({ ...f, server: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Login ID</Label><Input placeholder="Account login number" value={formData.login} onChange={(e) => setFormData(f => ({ ...f, login: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Password</Label><div className="relative"><Input type={showPassword ? 'text' : 'password'} placeholder="Trading password" value={formData.password} onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button></div></div>
                <Button className="w-full" onClick={handleConnect} disabled={isConnecting || !formData.platform || !formData.server || !formData.login || !formData.password}>{isConnecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</> : <><Link2 className="w-4 h-4 mr-2" />Connect Account</>}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No broker accounts connected yet.</p><p className="text-sm">Click "Add Account" to connect your trading account.</p></div>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div key={connection.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Activity className="w-5 h-5 text-primary" /></div>
                    <div><div className="font-medium">{connection.broker_name}</div><div className="text-sm text-muted-foreground">{connection.platform.toUpperCase()} • {connection.login}</div></div>
                  </div>
                  {getStatusBadge(connection.connection_status)}
                </div>
                {connection.connection_status === 'connected' && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Balance</div><div className="font-medium">{formatCurrency(connection.account_balance, connection.account_currency)}</div></div></div>
                    <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Equity</div><div className="font-medium">{formatCurrency(connection.account_equity, connection.account_currency)}</div></div></div>
                  </div>
                )}
                {connection.last_error && <div className="text-sm text-destructive bg-destructive/10 rounded p-2">{connection.last_error}</div>}
                <Separator />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleRefreshPositions(connection.id)} disabled={connection.connection_status !== 'connected' || refreshingId === connection.id}>{refreshingId === connection.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Positions</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSync(connection.id)} disabled={connection.connection_status !== 'connected' || syncingId === connection.id}>{syncingId === connection.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}Sync Trades</Button>
                  <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" onClick={() => fetchPositions(connection.id)} disabled={connection.connection_status !== 'connected'}><Eye className="w-4 h-4 mr-1" />View Positions</Button></DialogTrigger>
                    <DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Open Positions - {connection.broker_name}</DialogTitle></DialogHeader>
                      <div className="max-h-96 overflow-auto">{positions.length === 0 ? <div className="text-center py-8 text-muted-foreground">No open positions</div> : (
                        <Table><TableHeader><TableRow><TableHead>Symbol</TableHead><TableHead>Type</TableHead><TableHead>Volume</TableHead><TableHead>Open Price</TableHead><TableHead>Current</TableHead><TableHead>P&L</TableHead></TableRow></TableHeader>
                          <TableBody>{positions.map((pos) => <TableRow key={pos.id}><TableCell className="font-medium">{pos.symbol}</TableCell><TableCell><Badge variant={pos.type === 'buy' ? 'default' : 'destructive'}>{pos.type === 'buy' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}{pos.type.toUpperCase()}</Badge></TableCell><TableCell>{pos.volume}</TableCell><TableCell>{pos.open_price}</TableCell><TableCell>{pos.current_price || '-'}</TableCell><TableCell className={pos.profit >= 0 ? 'text-green-500' : 'text-red-500'}>{formatCurrency(pos.profit)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                      )}</div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => disconnectBroker(connection.id)}><Unlink className="w-4 h-4 mr-1" />Disconnect</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
