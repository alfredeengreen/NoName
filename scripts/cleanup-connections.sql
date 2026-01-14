-- Clean up idle connections
-- Run this as a superuser if you have too many connections

-- Kill all idle connections (except your own)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'analytics'
  AND pid <> pg_backend_pid()
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes';

-- Show current connections
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'analytics';


