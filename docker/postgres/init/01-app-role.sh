#!/bin/sh
# Runs once, on the FIRST start of an empty data volume (docker-entrypoint-initdb.d).
# Creates the runtime role acrms_app: LOGIN, not superuser, no BYPASSRLS, so row-level
# security always applies to the backend. Table privileges are granted by the Prisma
# migrations, not here.
set -eu

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set in the root .env}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" \
  -v db_name="$POSTGRES_DB" <<'EOSQL'
SELECT 'CREATE ROLE acrms_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acrms_app') \gexec

ALTER ROLE acrms_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION
  PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"db_name" TO acrms_app;
EOSQL
