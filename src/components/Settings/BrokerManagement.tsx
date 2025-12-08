import { useState, useEffect, useRef } from 'react';
import { Link2, Plus, Trash2, RefreshCw, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBrokerConnections, BrokerConnection, BrokerSyncStatus } from '@/hooks/useBrokerConnections';
import { useTradingAccounts, TradingAccount } from '@/hooks/useTradingAccounts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BrokerManagementProps {
  userId: string | undefined;
}

export function BrokerManagement({ userId }: BrokerManagementProps) {
  const { 
    connections, 
    syncStatuses, 
    isLoading, 
    isSyncing,
    connectAccount, 
    addConnection, 
    deleteConnection,
    syncTrades,
  } = useBrokerConnections(userId);
  
  const { accounts } = useTradingAccounts(userId);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedTradingAccount, setSelectedTradingAccount] = useState<string>('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<Record<string, boolean>>({});
  const syncIntervalRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Set default trading account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedTradingAccount) {
      const defaultAccount = accounts.find(a => a.is_default) || accounts[0];
      setSelectedTradingAccount(defaultAccount.id);
    }
  }, [accounts, selectedTradingAccount]);

  // Load auto-sync settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('broker_auto_sync');
    if (saved) {
      try {
        setAutoSyncEnabled(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Set up auto-sync intervals
  useEffect(() => {
    Object.entries(autoSyncEnabled).forEach(([connectionId, enabled]) => {
      if (enabled && selectedTradingAccount) {
        // Clear existing interval
        if (syncIntervalRef.current[connectionId]) {
          clearInterval(syncIntervalRef.current[connectionId]);
        }
        
        // Set up new interval (sync every 5 minutes)
        syncIntervalRef.current[connectionId] = setInterval(() => {
          console.log('Auto-syncing trades for connection:', connectionId);
          syncTrades(connectionId, selectedTradingAccount);
        }, 5 * 60 * 1000);
      } else if (syncIntervalRef.current[connectionId]) {
        clearInterval(syncIntervalRef.current[connectionId]);
        delete syncIntervalRef.current[connectionId];
      }
    });

    // Cleanup on unmount
    return () => {
      Object.values(syncIntervalRef.current).forEach(clearInterval);
    };
  }, [autoSyncEnabled, selectedTradingAccount, syncTrades]);

  const handleConnect = async () => {
    if (!accountId.trim()) {
      toast.error('Please enter a MetaAPI account ID');
      return;
    }

    setIsConnecting(true);
    try {
      const result = await connectAccount(accountId);
      if (result.success && result.accountInfo) {
        const connection = await addConnection(accountId, result.accountInfo);
        if (connection) {
          setAccountId('');
          setShowAddForm(false);
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleAutoSync = (connectionId: string) => {
    const newState = { ...autoSyncEnabled, [connectionId]: !autoSyncEnabled[connectionId] };
    setAutoSyncEnabled(newState);
    localStorage.setItem('broker_auto_sync', JSON.stringify(newState));
    
    if (newState[connectionId]) {
      toast.success('Auto-sync enabled (every 5 minutes)');
    } else {
      toast.success('Auto-sync disabled');
    }
  };

  const formatLastSync = (status: BrokerSyncStatus | undefined) => {
    if (!status?.last_sync_at) return 'Never synced';
    const date = new Date(status.last_sync_at);
    return `Last synced: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trading Account Selection */}
      {accounts.length > 0 && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Link trades to account:
          </label>
          <Select value={selectedTradingAccount} onValueChange={setSelectedTradingAccount}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select trading account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} {account.is_default ? '(Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Connected Accounts List */}
      {connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map(connection => {
            const status = syncStatuses[connection.id];
            const isThisSyncing = isSyncing === connection.id;
            const isAutoSync = autoSyncEnabled[connection.id];
            
            return (
              <div 
                key={connection.id}
                className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      status?.sync_status === 'success' ? "bg-green-500/20" : "bg-primary/20"
                    )}>
                      {status?.sync_status === 'success' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Link2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{connection.broker}</p>
                      <p className="text-xs text-muted-foreground">Login: {connection.login}</p>
                    </div>
                  </div>
                  
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    }
                    title="Remove Broker Connection"
                    description="Are you sure you want to remove this broker connection? Your synced trades will remain in the journal."
                    confirmLabel="Remove"
                    variant="destructive"
                    onConfirm={() => deleteConnection(connection.id)}
                  />
                </div>

                {/* Sync Status */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatLastSync(status)}</span>
                  {status?.trades_synced !== undefined && status.trades_synced > 0 && (
                    <span className="text-primary">{status.trades_synced} trades imported</span>
                  )}
                </div>

                {status?.last_error && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="w-3 h-3" />
                    <span>{status.last_error}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncTrades(connection.id, selectedTradingAccount)}
                    disabled={isThisSyncing || !selectedTradingAccount}
                    className="flex-1"
                  >
                    {isThisSyncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {isThisSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  
                  <Button
                    variant={isAutoSync ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAutoSync(connection.id)}
                    className={cn(
                      "flex-1",
                      isAutoSync && "bg-primary text-primary-foreground"
                    )}
                  >
                    {isAutoSync ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Link2 className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">No Broker Connected</p>
          <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
            Connect your MT4/MT5 account via MetaAPI to automatically sync your trades
          </p>
        </div>
      ) : null}

      {/* Add Connection Form */}
      {showAddForm ? (
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-4">
          <h4 className="font-medium text-foreground">Connect MetaAPI Account</h4>
          
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">MetaAPI Account ID</label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter your MetaAPI account ID"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Get your account ID from{' '}
              <a 
                href="https://app.metaapi.cloud/accounts" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MetaAPI Dashboard
              </a>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setAccountId('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !accountId.trim()}
              className="flex-1"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Connect MetaAPI Account
        </Button>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/20">
        <p className="font-medium">How to get your MetaAPI Account ID:</p>
        <ol className="list-decimal list-inside space-y-1 ml-1">
          <li>Sign up at <a href="https://metaapi.cloud" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">metaapi.cloud</a></li>
          <li>Add your MT4/MT5 account in the dashboard</li>
          <li>Copy the Account ID from your connected account</li>
          <li>Paste it here to start syncing trades!</li>
        </ol>
      </div>
    </div>
  );
}
