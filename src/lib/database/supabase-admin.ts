
import "server-only";
import { createClient } from "@supabase/supabase-js";

export class SupabaseConfigurationError extends Error {}

function runtimeEnvironment(name: string) {
    return process.env[name];
}

export function getSupabaseAdmin() {
    if (typeof window !== "undefined") {
        throw new SupabaseConfigurationError("Cliente exclusivo del servidor");
    }
    // Dynamic access prevents Next.js from freezing the public URL at build time.
    const url = runtimeEnvironment("SUPABASE_URL") ?? runtimeEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const secretKey = runtimeEnvironment("SUPABASE_SECRET_KEY");

    if (!url || !secretKey || /[\s"'\\]/.test(url + secretKey)) {
        throw new SupabaseConfigurationError("Variables de Supabase ausentes o mal formadas");
    }
    let projectUrl: URL;
    try {
        projectUrl = new URL(url);
        if (!['https:', 'http:'].includes(projectUrl.protocol) || projectUrl.username || projectUrl.password || projectUrl.pathname !== '/' || projectUrl.search || projectUrl.hash) throw new Error();
    } catch {
        throw new SupabaseConfigurationError("URL de Supabase invalida");
    }
    if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) {
        try {
            const parts = secretKey.split('.');
            const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            if (parts.length !== 3 || claims.role !== 'service_role' ||
                (typeof claims.exp === 'number' && claims.exp <= Date.now() / 1000) ||
                (projectUrl.hostname.endsWith('.supabase.co') && claims.ref !== projectUrl.hostname.split('.')[0])) throw new Error();
        } catch {
            throw new SupabaseConfigurationError("Se requiere una clave secreta o service_role del proyecto");
        }
    }

    return createClient(url, secretKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
