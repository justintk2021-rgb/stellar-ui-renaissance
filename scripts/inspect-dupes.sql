SELECT broker_position_id, COUNT(*) AS n
FROM trades
WHERE imported_from_broker = true AND broker_name = 'TradeLocker'
GROUP BY broker_position_id
HAVING COUNT(*) > 1;
