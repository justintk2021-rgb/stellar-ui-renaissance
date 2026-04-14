import { useState, useEffect } from "react";
import { ChevronDown, Plus, Settings, Check, Trash2, Star, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TradingAccount } from "@/hooks/useTradingAccounts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface BrokerAccountInfo {
  connectionId: string;
  accountId: string;
  accNum: number;
  accountName: string;
  environment: string;
  brokerName: string;
  balance: number | null;
  currency: string;
  status: string;
}

interface AccountSelectorProps {
  accounts: TradingAccount[];
  selectedAccount: TradingAccount | null;
  onSelectAccount: (accountId: string) => void;
  onSelectBrokerAccount?: (brokerAccountId: string | null) => void;
  onAddAccount: (data: { name: string; broker?: string; starting_balance?: number }) => Promise<TradingAccount | null>;
  onUpdateAccount: (id: string, data: Partial<TradingAccount>) => Promise<boolean>;
  onDeleteAccount: (id: string) => Promise<boolean>;
  onSetDefault: (id: string) => Promise<boolean>;
}

export const AccountSelector = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  onSelectBrokerAccount,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onSetDefault,
}: AccountSelectorProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBroker, setNewAccountBroker] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("10000");
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccountInfo[]>([]);
  const [selectedBrokerAccount, setSelectedBrokerAccount] = useState<string | null>(null);

  // Fetch broker-connected accounts
  useEffect(() => {
    const fetchBrokerAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: connections } = await supabase
        .from('broker_connections')
        .select('id, broker_name, environment, connection_status, active_account_id, active_acc_num, account_balance, account_currency')
        .eq('user_id', user.id)
        .eq('connection_status', 'connected');

      if (!connections?.length) {
        setBrokerAccounts([]);
        return;
      }

      const brokerAccs: BrokerAccountInfo[] = [];

      for (const conn of connections) {
        const { data: accs } = await supabase
          .from('broker_accounts')
          .select('account_id_external, acc_num, account_name, is_active')
          .eq('broker_connection_id', conn.id);

        if (accs) {
          for (const acc of accs) {
            brokerAccs.push({
              connectionId: conn.id,
              accountId: acc.account_id_external,
              accNum: acc.acc_num,
              accountName: acc.account_name || `Account ${acc.acc_num}`,
              environment: conn.environment || 'demo',
              brokerName: conn.broker_name,
              balance: acc.is_active ? conn.account_balance : null,
              currency: conn.account_currency || 'USD',
              status: conn.connection_status || 'disconnected',
            });
          }
        }
      }

      setBrokerAccounts(brokerAccs);
    };

    fetchBrokerAccounts();
  }, []);

  const isBrokerSelected = !!selectedBrokerAccount;
  const displayName = isBrokerSelected
    ? brokerAccounts.find(b => `broker-${b.connectionId}-${b.accNum}` === selectedBrokerAccount)?.accountName || "Broker Account"
    : selectedAccount?.name || "Select Account";

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    
    const result = await onAddAccount({
      name: newAccountName,
      broker: newAccountBroker || undefined,
      starting_balance: parseFloat(newAccountBalance) || 10000,
    });
    
    if (result) {
      setIsAddDialogOpen(false);
      setNewAccountName("");
      setNewAccountBroker("");
      setNewAccountBalance("10000");
      setSelectedBrokerAccount(null);
      onSelectAccount(result.id);
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount || !newAccountName.trim()) return;
    
    const success = await onUpdateAccount(editingAccount.id, {
      name: newAccountName,
      broker: newAccountBroker || null,
      starting_balance: parseFloat(newAccountBalance) || 10000,
    });
    
    if (success) {
      setIsEditDialogOpen(false);
      setEditingAccount(null);
    }
  };

  const openEditDialog = (account: TradingAccount) => {
    setEditingAccount(account);
    setNewAccountName(account.name);
    setNewAccountBroker(account.broker || "");
    setNewAccountBalance(account.starting_balance.toString());
    setIsEditDialogOpen(true);
  };

  const handleSelectManualAccount = (accountId: string) => {
    setSelectedBrokerAccount(null);
    onSelectAccount(accountId);
  };

  const handleSelectBrokerAccount = (broker: BrokerAccountInfo) => {
    const brokerId = `broker-${broker.connectionId}-${broker.accNum}`;
    setSelectedBrokerAccount(brokerId);
    // We still select the default manual account for trades storage,
    // but the UI will show broker account info
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2 min-w-[180px] justify-between bg-background/50 border-border/50"
          >
            <div className="flex items-center gap-2 truncate">
              {isBrokerSelected ? (
                <Link2 className="w-3 h-3 text-primary shrink-0" />
              ) : selectedAccount?.is_default ? (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
              ) : null}
              <span className="truncate">{displayName}</span>
            </div>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px] bg-popover border-border z-50">
          {/* Manual Trading Accounts */}
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Manual Accounts
          </DropdownMenuLabel>
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => handleSelectManualAccount(account.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {account.is_default && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                )}
                <span className="truncate">{account.name}</span>
                {account.broker && (
                  <span className="text-xs text-muted-foreground truncate">({account.broker})</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isBrokerSelected && selectedAccount?.id === account.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(account);
                  }}
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}

          {/* Broker-Connected Accounts */}
          {brokerAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <Link2 className="w-3 h-3" />
                Broker Connected
              </DropdownMenuLabel>
              {brokerAccounts.map((broker) => {
                const brokerId = `broker-${broker.connectionId}-${broker.accNum}`;
                return (
                  <DropdownMenuItem
                    key={brokerId}
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => handleSelectBrokerAccount(broker)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Link2 className="w-3 h-3 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm">{broker.accountName}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {broker.brokerName} · {broker.environment.toUpperCase()}
                          {broker.balance != null && ` · $${broker.balance.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                    {selectedBrokerAccount === brokerId && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            className="cursor-pointer text-primary"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Trading Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g., Main Account, Demo Account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="broker">Broker (optional)</Label>
              <Input
                id="broker"
                value={newAccountBroker}
                onChange={(e) => setNewAccountBroker(e.target.value)}
                placeholder="e.g., IC Markets, OANDA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">Starting Balance</Label>
              <Input
                id="balance"
                type="number"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={!newAccountName.trim()}>
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Account name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-broker">Broker (optional)</Label>
              <Input
                id="edit-broker"
                value={newAccountBroker}
                onChange={(e) => setNewAccountBroker(e.target.value)}
                placeholder="Broker name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-balance">Starting Balance</Label>
              <Input
                id="edit-balance"
                type="number"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            {editingAccount && (!editingAccount.is_default || accounts.length > 1) && (
              <div className="flex gap-2 w-full">
                {!editingAccount.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onSetDefault(editingAccount.id);
                      setIsEditDialogOpen(false);
                    }}
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Set Default
                  </Button>
                )}
                {accounts.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onDeleteAccount(editingAccount.id);
                      setIsEditDialogOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditAccount} disabled={!newAccountName.trim()}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
