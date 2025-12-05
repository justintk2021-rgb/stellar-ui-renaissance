import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link2, Link2Off, RefreshCw, Shield, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BrokerConnectionProps {
  onTradesImported?: (trades: any[]) => void;
}

// Popular MT5 broker servers
const POPULAR_BROKERS = [
  { name: "ICMarkets", servers: ["ICMarketsSC-Demo", "ICMarketsSC-Live01", "ICMarketsSC-Live02", "ICMarketsSC-Live03"] },
  { name: "Exness", servers: ["Exness-MT5Real", "Exness-MT5Real2", "Exness-MT5Demo"] },
  { name: "XM", servers: ["XMGlobal-MT5", "XMGlobal-MT5 2", "XMGlobal-MT5 3"] },
  { name: "FXCM", servers: ["FXCM-MT5Live01", "FXCM-MT5Demo01"] },
  { name: "Pepperstone", servers: ["Pepperstone-MT5-Live01", "Pepperstone-MT5-Demo01"] },
  { name: "OANDA", servers: ["OANDA-MT5 Live-1", "OANDA-MT5 Practice-1"] },
  { name: "FxPro", servers: ["FxPro.com-MT5", "FxPro.com-Demo MT5"] },
];

export function BrokerConnection({ onTradesImported }: BrokerConnectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'syncing'>('disconnected');
  
  const [formData, setFormData] = useState({
    broker: '',
    server: '',
    customServer: '',
    login: '',
    investorPassword: '',
    platform: 'mt5' as 'mt4' | 'mt5',
  });

  // Load saved connection from localStorage
  const [savedConnection, setSavedConnection] = useState<{
    accountId: string;
    broker: string;
    login: string;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('broker_connection');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSavedConnection(parsed);
      setConnectionStatus('connected');
    }
  }, []);

  const handleConnect = async () => {
    if (!formData.login || !formData.investorPassword || (!formData.server && !formData.customServer)) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      const server = formData.customServer || formData.server;
      
      // Create account via edge function
      const { data, error } = await supabase.functions.invoke('broker-sync', {
        body: {
          action: 'create-account',
          login: formData.login,
          password: formData.investorPassword,
          server: server,
          platform: formData.platform,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to connect');

      // Deploy the account
      const deployResult = await supabase.functions.invoke('broker-sync', {
        body: {
          action: 'deploy-account',
          accountId: data.accountId,
        },
      });

      if (deployResult.error) throw deployResult.error;

      // Save connection info
      const connection = {
        accountId: data.accountId,
        broker: formData.broker || 'Custom',
        login: formData.login,
      };
      localStorage.setItem('broker_connection', JSON.stringify(connection));
      setSavedConnection(connection);
      setConnectionStatus('connected');
      
      toast.success("Broker connected successfully! Syncing may take a few minutes.");
      setIsOpen(false);
      
      // Reset form
      setFormData({
        broker: '',
        server: '',
        customServer: '',
        login: '',
        investorPassword: '',
        platform: 'mt5',
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      toast.error(error.message || "Failed to connect to broker");
      setConnectionStatus('disconnected');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!savedConnection?.accountId) return;
    
    setIsSyncing(true);
    setConnectionStatus('syncing');

    try {
      // Check account status first
      const statusResult = await supabase.functions.invoke('broker-sync', {
        body: {
          action: 'get-account-status',
          accountId: savedConnection.accountId,
        },
      });

      if (statusResult.error) throw statusResult.error;
      
      if (statusResult.data.state !== 'DEPLOYED') {
        toast.info(`Account is ${statusResult.data.state}. Please wait for deployment to complete.`);
        setConnectionStatus('connected');
        setIsSyncing(false);
        return;
      }

      // Fetch trades
      const { data, error } = await supabase.functions.invoke('broker-sync', {
        body: {
          action: 'get-trades',
          accountId: savedConnection.accountId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || data.message);

      const trades = data.trades || [];
      
      if (trades.length === 0) {
        toast.info("No trades found in the last 30 days");
      } else {
        toast.success(`Synced ${trades.length} trades from your broker`);
        onTradesImported?.(trades);
      }
      
      setConnectionStatus('connected');
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || "Failed to sync trades");
      setConnectionStatus('connected');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!savedConnection?.accountId) return;

    try {
      await supabase.functions.invoke('broker-sync', {
        body: {
          action: 'disconnect',
          accountId: savedConnection.accountId,
        },
      });

      localStorage.removeItem('broker_connection');
      setSavedConnection(null);
      setConnectionStatus('disconnected');
      toast.success("Broker disconnected");
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error("Failed to disconnect");
    }
  };

  const selectedBroker = POPULAR_BROKERS.find(b => b.name === formData.broker);

  return (
    <div className="glass rounded-2xl p-4 border border-border/40 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            connectionStatus === 'connected' ? 'bg-green-500/20' : 
            connectionStatus === 'syncing' ? 'bg-primary/20' : 'bg-muted/50'
          }`}>
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : connectionStatus === 'syncing' ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Link2Off className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Broker Connection</h3>
            {savedConnection ? (
              <p className="text-xs text-muted-foreground">
                {savedConnection.broker} • {savedConnection.login}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Connect to auto-journal trades</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedConnection ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="text-xs"
              >
                {isSyncing ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="text-xs text-destructive hover:text-destructive"
              >
                <Link2Off className="w-3 h-3 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs"
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  Connect Broker
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Connect Your Broker
                  </DialogTitle>
                  <DialogDescription>
                    Use your investor (read-only) password to securely connect and auto-journal your trades.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Platform</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value as 'mt4' | 'mt5' }))}
                    >
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mt5">MetaTrader 5</SelectItem>
                        <SelectItem value="mt4">MetaTrader 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Broker (Optional)</Label>
                    <Select
                      value={formData.broker}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, broker: value, server: '' }))}
                    >
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue placeholder="Select your broker" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_BROKERS.map((broker) => (
                          <SelectItem key={broker.name} value={broker.name}>
                            {broker.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="other">Other (Enter manually)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBroker ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Server</Label>
                      <Select
                        value={formData.server}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, server: value }))}
                      >
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select server" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedBroker.servers.map((server) => (
                            <SelectItem key={server} value={server}>
                              {server}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Server Address</Label>
                      <Input
                        placeholder="e.g., BrokerName-MT5Live"
                        value={formData.customServer}
                        onChange={(e) => setFormData(prev => ({ ...prev, customServer: e.target.value }))}
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Find this in MT5: File → Open an Account
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Login / Account Number</Label>
                    <Input
                      placeholder="12345678"
                      value={formData.login}
                      onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                      className="bg-muted/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      Investor Password
                      <Badge variant="outline" className="text-[10px] ml-1">Read-Only</Badge>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Your investor password"
                        value={formData.investorPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, investorPassword: e.target.value }))}
                        className="bg-muted/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is NOT your trading password. The investor password only allows viewing.
                    </p>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>
                        Your credentials are securely transmitted and never stored on our servers. 
                        We use MetaApi's enterprise-grade infrastructure to connect to your broker.
                      </span>
                    </p>
                  </div>

                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-r from-primary to-secondary"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Connect Broker
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
