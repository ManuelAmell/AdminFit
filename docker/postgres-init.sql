-- Se ejecuta una sola vez al crear el volumen (docker-entrypoint-initdb.d).
-- La app NUNCA debe conectarse como superusuario: Postgres ignora RLS para superusuarios
-- y el aislamiento entre gimnasios dejaría de aplicarse.
CREATE ROLE adminfit_app LOGIN PASSWORD 'adminfit_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER DATABASE adminfit OWNER TO adminfit_app;
GRANT ALL ON SCHEMA public TO adminfit_app;
ALTER SCHEMA public OWNER TO adminfit_app;
