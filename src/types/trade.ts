export interface Trade {
  id: string;
  date: string;
  pair: string;
  direction: 'Long' | 'Short';
  result: number;
  session?: string;
  strategy?: string;
  notes?: string;
  notebook?: string;
  chartImage?: string; // Base64 image of trade chart with entry/TP/SL
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
}
