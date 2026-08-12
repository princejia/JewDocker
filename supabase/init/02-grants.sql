-- 兜底授权：ALTER DEFAULT PRIVILEGES 只影响之后创建的对象，
-- 这里对 schema.sql 已建好的表再显式授权一次，并通知 PostgREST 重载 schema 缓存。
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';
