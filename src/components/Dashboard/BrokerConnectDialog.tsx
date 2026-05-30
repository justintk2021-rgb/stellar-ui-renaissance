import { lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

const BrokerManagement = lazy(() =>
  import("@/components/Settings/BrokerManagement").then((m) => ({
    default: m.BrokerManagement,
  }))
);

interface BrokerConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectionComplete: () => void;
}

export function BrokerConnectDialog({
  open,
  onOpenChange,
  onConnectionComplete,
}: BrokerConnectDialogProps) {
  const handleComplete = () => {
    onConnectionComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Broker Management</DialogTitle>
          <DialogDescription>
            Connect TradeLocker, MetaTrader 5, or Myfxbook. Once linked, you&apos;ll return to the dashboard.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6 max-h-[calc(90vh-7rem)]">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
            <BrokerManagement variant="connect" onConnectionComplete={handleComplete} />
          </Suspense>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
