export interface BrokerPosition {
  id: string;
  broker_connection_id: string;
  position_id: string;
  symbol: string;
  type: string;
  side: string | null;
  volume: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  floating_pl: number;
  open_time: string;
}
