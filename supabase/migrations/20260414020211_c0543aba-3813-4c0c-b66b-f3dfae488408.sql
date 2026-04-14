CREATE POLICY "Users can delete their own sync logs"
ON public.broker_sync_logs
FOR DELETE
USING (EXISTS ( SELECT 1
   FROM broker_connections bc
  WHERE ((bc.id = broker_sync_logs.broker_connection_id) AND (bc.user_id = auth.uid()))));