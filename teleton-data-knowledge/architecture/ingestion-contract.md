# Contrato de ingesta v1

## Objetivo
Recibir lotes de registros provenientes de Blue Prism.

## Endpoint
POST /api/ingestion

## Formato propuesto

{
  "source": "BUK",
  "sheet": "Dotacion_2026",
  "batch_id": "UUID",
  "records": [
    {
      "PersonaId": 71027,
      "Instituto": "PMo",
      "Periodo": "2026-01-01",
      "Horas Semanales": 32,
      "Cargo": "ASISTENTE SOCIAL"
    }
  ]
}

## Requisitos
- Autenticacion de solicitudes
- Validacion del esquema JSON
- Idempotencia por lote y registro
- Trazabilidad de origen
- Registro de errores
- Separacion de datos validos e invalidos
- Reprocesamiento controlado

## Estado
PROPUESTA - Pendiente de implementar y validar con Blue Prism.
