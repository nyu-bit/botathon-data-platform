const fs = require('node:fs');
const path = require('node:path');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const files = walk('/app/.next/server').filter(f => f.endsWith('.js'));
let mismatches = 0, matches = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const url of text.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co/g)) {
    if (url[0] === process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')) matches++;
    else mismatches++;
  }
}
console.log({ compiledUrlMatches: matches, compiledUrlMismatches: mismatches });
