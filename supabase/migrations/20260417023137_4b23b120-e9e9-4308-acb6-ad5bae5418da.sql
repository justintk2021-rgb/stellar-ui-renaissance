DELETE FROM public.notebook_entries
WHERE trade_id IS NOT NULL
  AND category = 'trade-notes'
  AND content LIKE '%Trade Plan%'
  AND content LIKE '%Post-Trade Review%';