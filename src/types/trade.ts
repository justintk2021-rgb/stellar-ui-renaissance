// Nested child state for conditional checklists
export interface ChecklistChildState {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  children?: ChecklistChildState[];
}

// Sub-item state with potential nested children
export interface ChecklistSubItemState {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  children?: ChecklistChildState[];
}

export interface ChecklistItemState {
  id: string;
  text: string;
  checked: boolean;
  percentage?: number;
  percentageType?: "fixed" | "conditional"; // "fixed" = full % when any sub-item selected, "conditional" = sum of selected
  subItems?: ChecklistSubItemState[];
}

export interface Trade {
  id: string;
  date: string;
  pair: string;
  direction: 'Long' | 'Short';
  result: number;
  session?: string;
  notes?: string;
  notebook?: string;
  chartImage?: string;
  accountId?: string;
  checklistId?: string;
  checklistState?: ChecklistItemState[];
  // Broker fields
  brokerName?: string;
  brokerEnvironment?: string;
  brokerAccountId?: string;
  brokerAccNum?: number;
  brokerOrderId?: string;
  brokerPositionId?: string;
  importedFromBroker?: boolean;
  lastBrokerSyncAt?: string;
  executionType?: string;
}

export interface DailyStats {
  pnl: number;
  trades: number;
}

export interface NotebookEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  date: string;
  tradeId?: string; // Optional link to a trade
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean; // Soft delete flag for trash
  deletedAt?: string; // When it was moved to trash
}
