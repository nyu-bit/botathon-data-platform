# Verificacion de ingesta RAW

El cliente administrativo lee SUPABASE_URL (opcional) o NEXT_PUBLIC_SUPABASE_URL
mediante un nombre de variable dinamico para evitar que Next.js sustituya la URL
durante el build. SUPABASE_SECRET_KEY se utiliza exclusivamente en el servidor.
Compose carga .env.local en ejecucion; los argumentos publicos de build pueden
proceder de otro entorno. No usar una URL publica incrustada en el cliente admin.

## Comprobaciones

- `npm.cmd run build` (Windows PowerShell).
- `docker compose config --quiet`.
- `docker compose up -d --build frontend`.
- `node scripts/check-supabase.cjs`: solo lectura, incluye columnas y BUK.
- `node scripts/check-ingestion.cjs`: autenticacion y validacion, sin escrituras.
- `node scripts/check-ingestion.cjs --write-test`: crea un lote BUK con dos
  registros sinteticos, comprueba payloads almacenados y reenvio sin duplicados.
  Ejecutar solo contra una base destinada a las pruebas autorizadas. Conserva
  el lote de prueba; no elimina datos.
- `Get-Content -Raw scripts/check-standalone.cjs | docker compose exec -T frontend node`:
  comprueba URLs incrustadas sin mostrar sus valores. No requiere el SDK dentro
  del runner standalone: las dependencias pueden estar incluidas en los chunks.

## Resultado verificado

Lote de prueba: `8662a9b0-9fe5-4551-a1ba-692b02e73c47`.
HTTP 200, completed, dos registros RAW; reenvio HTTP 200 con duplicate=true,
dos registros RAW en total. BUK habilitada. Las consultas de columnas del
endpoint en source_config, ingestion_batches y raw_records devuelven HTTP 200.

## Riesgos pendientes (fuera de esta correccion)

- Lookup e insercion del lote no son atomicos: peticiones simultaneas pueden
  competir y una terminar en conflicto de clave primaria.
- Un lote failed o processing existente se devuelve como duplicado y no se
  reanuda. No hay recuperacion automatica de lotes parciales.
- Insercion de lote, insercion RAW y finalizacion son operaciones separadas;
  un fallo de finalizacion puede dejar RAW guardados y estado processing.
- El mismo UUID con un contenido o fuente diferente se trata como duplicado;
  no se compara una huella del payload.

Una futura correccion debe definir transacciones e idempotencia concurrente
antes de habilitar reprocesamiento. No se cambio RLS ni el esquema existente.
