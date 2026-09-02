SELECT t.date, t.pair, t.direction, t.result, t.open_price, t.close_price, t.close_time,
  h.realized_pl, h.size, h.entry_price, h.exit_price
FROM trades t
LEFT JOIN broker_trade_history h ON h.broker_position_id = t.broker_position_id
WHERE t.date >= '2026-05-12'
  AND t.imported_from_broker = true
  AND t.broker_name = 'TradeLocker'
ORDER BY t.date DESC;
