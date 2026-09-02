SELECT t.date,
  COUNT(*) AS trades,
  ROUND(SUM(t.result::numeric), 2) AS journal_sum
FROM trades t
WHERE t.imported_from_broker = true
  AND t.broker_name = 'TradeLocker'
GROUP BY t.date
ORDER BY t.date DESC
LIMIT 15;
