// Read-only diagnostics. Never prints credentials or database records.
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SECRET_KEY || '';
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'INGESTION_API_TOKEN']) {
    const value = process.env[name] || '';
    console.log(name, { present: !!value, whitespace: /\s/.test(value), quotes: /["']/.test(value), escapes: /\\/.test(value) });
  }
  console.log('Key format:', key.startsWith('sb_secret_') ? 'secret' : key.startsWith('eyJ') ? 'JWT' : 'unsupported');
  if (key.startsWith('eyJ')) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
    console.log('JWT checks:', { adminRole: claims.role === 'service_role', projectMatches: claims.ref === new URL(url).hostname.split('.')[0], expired: typeof claims.exp === 'number' && claims.exp < Date.now() / 1000 });
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const buk = await db.from('source_config').select('source_code,enabled').eq('source_code', 'BUK').maybeSingle();
  console.log('BUK:', { status: buk.status, code: buk.error?.code || null, found: !!buk.data, enabled: buk.data?.enabled ?? null });
  for (const [table, columns] of Object.entries({
    source_config: 'source_code,enabled',
    ingestion_batches: 'id,source_code,sheet_name,status,rows_received,completed_at',
    raw_records: 'batch_id,source_row,payload',
    data_quality_issues: '*',
  })) {
    const { error, status } = await db.from(table).select(columns).limit(0);
    console.log('Schema check:', { table, status, code: error?.code || null, success: !error });
    if (error) process.exitCode = 1;
  }
}
main().catch(() => { console.error('Diagnostic failed (configuration or connection).'); process.exitCode = 1; });
