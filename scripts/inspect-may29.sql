SELECT broker_position_id, size, raw_payload
FROM broker_trade_history
WHERE symbol ILIKE '%AUDCAD%'
  AND closed_at >= '2026-05-29'
ORDER BY closed_at DESC
LIMIT 1;
