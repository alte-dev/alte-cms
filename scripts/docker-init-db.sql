-- Initialize separate databases and roles for Medusa and Payload CMS
-- DEV ONLY: Obvious fake credentials for local development. Never used in production!

-- Medusa Database & Role
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'medusa_user') THEN
      CREATE ROLE medusa_user WITH LOGIN PASSWORD 'dev-only-medusa-password';
   END IF;
END
$do$;

SELECT 'CREATE DATABASE medusa_db OWNER medusa_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'medusa_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE medusa_db TO medusa_user;

-- Payload CMS Database & Role
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'payload_user') THEN
      CREATE ROLE payload_user WITH LOGIN PASSWORD 'dev-only-payload-password';
   END IF;
END
$do$;

SELECT 'CREATE DATABASE payload_db OWNER payload_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payload_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE payload_db TO payload_user;
