#!/bin/bash
# PostgREST 所需的角色。必须在 schema.sql 之前执行（文件名 00 前缀保证顺序），
# 因为 schema.sql 里的 RLS 策略引用了 authenticated 角色。
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- PostgREST 用匿名/已登录/服务三种角色区分权限；本应用只用 service_role
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;

  -- PostgREST 实际登录用的角色，NOINHERIT 保证它只能通过 SET ROLE 获得权限
  CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${AUTHENTICATOR_PASSWORD}';
  GRANT anon, authenticated, service_role TO authenticator;

  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

  -- 建表发生在本脚本之后，用默认权限保证新表自动授权给 service_role
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO service_role;
EOSQL
