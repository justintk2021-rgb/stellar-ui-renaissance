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
}

export interface DailyStats {
  pnl: number;
  trades: number;
}
