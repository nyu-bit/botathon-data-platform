const crypto = require('node:crypto');
if (process.argv.includes('--local')) require('@next/env').loadEnvConfig(process.cwd());
const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'INGESTION_API_TOKEN'];
console.log(JSON.stringify(Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(process.env[name] || '').digest('hex')]))));
