// Run against local Docker only; synthetic payload, no personal data.
require('@next/env').loadEnvConfig(process.cwd());
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
async function main() {
  const endpoint = 'http://localhost:3000/api/ingestion';
  const unauthorized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  console.log('Without token:', unauthorized.status);
  assert.equal(unauthorized.status, 401);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INGESTION_API_TOKEN}` };
  for (const invalid of ['{', '{}']) {
    const response = await fetch(endpoint, { method: 'POST', headers, body: invalid });
    console.log('Invalid JSON/contract:', response.status);
    assert.equal(response.status, 400);
  }
  if (process.argv.includes('--write-test')) {
    const { createClient } = require('@supabase/supabase-js');
    const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const batch = { source: 'BUK', sheet: 'Dotacion_2026', batch_id: randomUUID(), records: [{ test: true, test_record: 'synthetic-1' }, { test: true, test_record: 'synthetic-2' }] };
    const send = () => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(batch) });
    const response = await send();
    const body = await response.json();
    console.log('Test ingestion:', { http: response.status, ...body });
    assert.equal(response.status, 200);
    assert.equal(body.status, 'completed');
    assert.equal(body.records_saved, 2);
    const stored = await db.from('ingestion_batches').select('id,status,rows_received').eq('id', batch.batch_id).single();
    assert.equal(stored.error, null);
    assert.equal(stored.data.status, 'completed');
    assert.equal(stored.data.rows_received, 2);
    const raw = await db.from('raw_records').select('source_row,payload').eq('batch_id', batch.batch_id).order('source_row');
    assert.equal(raw.error, null);
    assert.deepEqual(raw.data, batch.records.map((payload, i) => ({ source_row: i + 1, payload })));
    const duplicate = await send();
    const duplicateBody = await duplicate.json();
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.duplicate, true);
    const count = await db.from('raw_records').select('*', { count: 'exact', head: true }).eq('batch_id', batch.batch_id);
    assert.equal(count.error, null);
    assert.equal(count.count, 2);
    console.log('Verified:', { batch_id: batch.batch_id, persistedBatch: true, rawRecords: count.count, duplicateHttp: duplicate.status, duplicate: true });
    return;
  }
  // A nonexistent source verifies upstream authentication without writing to a
  // database whose production/test classification has not been confirmed.
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INGESTION_API_TOKEN}` },
    body: JSON.stringify({ source: `diagnostic-${randomUUID()}`, sheet: 'connection_check', batch_id: randomUUID(), records: [{ test: true, row: 1 }, { test: true, row: 2 }] }),
  });
  const body = await response.json();
  console.log('Authenticated request:', { status: response.status, code: body.code || null });
  if (unauthorized.status !== 401) process.exitCode = 1;
}
main().catch(() => { console.error('Local API check failed.'); process.exitCode = 1; });
