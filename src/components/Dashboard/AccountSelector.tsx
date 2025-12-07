import { useState } from "react";
import { ChevronDown, Plus, Settings, Check, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

interface AccountSelectorProps {
  accounts: TradingAccount[];
  selectedAccount: TradingAccount | null;
  onSelectAccount: (accountId: string) => void;
  onAddAccount: (data: { name: string; broker?: string; starting_balance?: number }) => Promise<TradingAccount | null>;
  onUpdateAccount: (id: string, data: Partial<TradingAccount>) => Promise<boolean>;
  onDeleteAccount: (id: string) => Promise<boolean>;
  onSetDefault: (id: string) => Promise<boolean>;
}

export const AccountSelector = ({
  accounts,
  selectedAccount,
  onSelectAccount,
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2 min-w-[180px] justify-between bg-background/50 border-border/50"
          >
            <div className="flex items-center gap-2 truncate">
              {selectedAccount?.is_default && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
              )}
              <span className="truncate">{selectedAccount?.name || "Select Account"}</span>
            </div>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px] bg-popover border-border z-50">
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => onSelectAccount(account.id)}
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
                {selectedAccount?.id === account.id && (
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
            {/* Action buttons row */}
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
                {accounts.length > 1 && (
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
            {/* Save/Cancel buttons row */}
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
