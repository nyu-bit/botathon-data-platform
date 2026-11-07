
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin, SupabaseConfigurationError } from "@/lib/database/supabase-admin";

export const runtime = "nodejs";

const schema = z.object({
    source: z.string().min(1),
    sheet: z.string().min(1),
    batch_id: z.string().uuid(),
    records: z.array(
        z.record(z.string(), z.unknown())
    ).min(1).max(500),
});

export async function POST(request: NextRequest) {
    const token = process.env.INGESTION_API_TOKEN;
    const authorization = request.headers.get("authorization");

    if (!token) {
        return NextResponse.json(
            { error: "API no configurada" },
            { status: 503 }
        );
    }

    const expected = Buffer.from(`Bearer ${token}`);
    const received = Buffer.from(authorization ?? "");

    if (
        expected.length !== received.length ||
        !timingSafeEqual(expected, received)
    ) {
        return NextResponse.json(
            { error: "No autorizado" },
            { status: 401 }
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "JSON invalido" },
            { status: 400 }
        );
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Contrato de ingesta invalido",
                details: parsed.error.issues,
            },
            { status: 400 }
        );
    }

    const { source, sheet, batch_id, records } = parsed.data;
    let operation = "configuration";
    let upstreamStatus: number | undefined;

    function checkResult(result: { error: unknown; status: number }) {
        upstreamStatus = result.status;
        if (result.error) throw result.error;
    }

    try {
        const db = getSupabaseAdmin();

        // Verificar que la fuente esté registrada y habilitada
        operation = "source_config_lookup";
        const configResult = await db
            .from("source_config")
            .select("source_code, enabled")
            .eq("source_code", source)
            .maybeSingle();

        checkResult(configResult);
        const config = configResult.data;

        if (!config || !config.enabled) {
            return NextResponse.json(
                { error: "Fuente no registrada o deshabilitada" },
                { status: 400 }
            );
        }

        // Evitar procesar nuevamente el mismo lote
        operation = "batch_lookup";
        const lookupResult = await db
            .from("ingestion_batches")
            .select("id, status, rows_received")
            .eq("id", batch_id)
            .maybeSingle();

        checkResult(lookupResult);
        const existing = lookupResult.data;

        if (existing) {
            return NextResponse.json({
                status: existing.status,
                batch_id: existing.id,
                records_received: existing.rows_received,
                duplicate: true,
            });
        }

        // Registrar el lote
        operation = "batch_insert";
        const batchResult = await db
            .from("ingestion_batches")
            .insert({
                id: batch_id,
                source_code: source,
                sheet_name: sheet,
                status: "processing",
                rows_received: records.length,
            });

        checkResult(batchResult);

        // Guardar los registros originales sin modificarlos
        const rows = records.map((record, index) => ({
            batch_id,
            source_row: index + 1,
            payload: record,
        }));

        operation = "raw_insert";
        const recordsResult = await db
            .from("raw_records")
            .insert(rows);

        if (recordsResult.error) {
            await db
                .from("ingestion_batches")
                .update({ status: "failed" })
                .eq("id", batch_id);

            checkResult(recordsResult);
        }

        // Finalizar lote
        operation = "batch_complete";
        const finishResult = await db
            .from("ingestion_batches")
            .update({
                status: "completed",
                completed_at: new Date().toISOString(),
            })
            .eq("id", batch_id);

        checkResult(finishResult);

        return NextResponse.json({
            status: "completed",
            source,
            sheet,
            batch_id,
            records_received: records.length,
            records_saved: records.length,
        });

    } catch (error) {
        const failure = error as { code?: string; message?: string } | null;
        const configuration = error instanceof SupabaseConfigurationError;
        const authentication = upstreamStatus === 401 || /invalid api key|invalid jwt|jwt expired/i.test(failure?.message ?? "") ||
            ["PGRST301", "PGRST302", "PGRST303"].includes(failure?.code ?? "");
        const code = configuration ? "SUPABASE_CONFIGURATION_ERROR" :
            authentication ? "SUPABASE_AUTHENTICATION_ERROR" : "SUPABASE_PERSISTENCE_ERROR";
        // Do not log upstream messages, payloads, headers, or credentials.
        console.error("Ingestion error:", { operation, status: upstreamStatus, code });

        return NextResponse.json(
            { error: configuration ? "Configuracion de Supabase invalida" :
                authentication ? "Supabase rechazo las credenciales del servidor" :
                "Error al persistir el lote", code },
            { status: configuration || authentication ? 503 : 500 }
        );
    }
}
