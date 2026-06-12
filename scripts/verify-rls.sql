-- ============================================================================
-- RLS verification script
-- ----------------------------------------------------------------------------
-- Paste each block into the Supabase SQL editor
-- (Dashboard → SQL Editor → New query) and run.
-- Read-only — does not modify your database.
-- ============================================================================


-- 1) Every table in the `public` schema, and whether RLS is enabled on it.
--    Any row with rls_enabled = false on a user-data table is a problem.
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'        -- only ordinary tables
ORDER BY c.relrowsecurity ASC, c.relname;


-- 2) Tables that have RLS enabled but ZERO policies attached.
--    With RLS on and no policy, the table is effectively locked down for
--    anon/authenticated roles — usually a bug if the app needs to read it.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  COALESCE(p.policy_count, 0) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT polrelid, COUNT(*) AS policy_count
  FROM pg_policy
  GROUP BY polrelid
) p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND COALESCE(p.policy_count, 0) = 0
ORDER BY c.relname;


-- 3) Full list of policies in public, with the using/check expressions.
--    Scan for any policy that does NOT reference auth.uid() — those may be
--    too permissive for user-scoped data.
SELECT
  pol.polname     AS policy_name,
  c.relname       AS table_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END             AS command,
  pol.polroles::regrole[] AS roles,
  pg_get_expr(pol.polqual, pol.polrelid)      AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression
FROM pg_policy pol
JOIN pg_class c     ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, pol.polname;


-- 4) Storage buckets and whether each is public.
--    Public buckets are readable by anyone with the URL — make sure that's
--    intentional (e.g. logo assets) and never used for user uploads.
SELECT id, name, public, created_at
FROM storage.buckets
ORDER BY name;


-- 5) Quick row-count check on the user-data tables.
--    If you log in as a normal user (not service role) and run a SELECT,
--    you should only see YOUR rows. If you see other users' rows, RLS is
--    not being enforced correctly. Run these one at a time as a regular user.
--
--    SELECT count(*) FROM public.trades;
--    SELECT count(*) FROM public.broker_connections;
--    SELECT count(*) FROM public.notebook_entries;
--    SELECT count(*) FROM public.user_settings;


-- ============================================================================
-- What "good" looks like:
--   - Query 1:  every user-data table has rls_enabled = true
--   - Query 2:  returns 0 rows (no table is RLS-on-but-policy-less by accident)
--   - Query 3:  every user-data policy references auth.uid() somewhere
--   - Query 4:  no public bucket holds private user data
-- ============================================================================
