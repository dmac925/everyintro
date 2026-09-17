// House rule: no em dashes in site copy. Scans user-facing source, skipping
// comment lines. Run via `npm run check:copy` (part of `npm run check`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src/routes', 'src/lib/components', 'src/lib/copy.ts', 'src/lib/schemas.ts', 'src/lib/brand.ts', 'src/lib/server/intake', 'src/lib/server/email.ts', 'src/lib/server/claude.ts'];
const files = [];
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.(svelte|ts)$/.test(p) && files.push(p));
roots.forEach(walk);

const hits = [];
for (const file of files) {
	readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
		const t = line.trim();
		if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
		if (line.includes('—') || line.includes('\\u2014')) hits.push(`${file}:${i + 1}: ${t.slice(0, 110)}`);
	});
}
// The prompt line that *forbids* em dashes has to mention one.
const real = hits.filter((h) => !h.includes('Never use em dashes'));
if (real.length) {
	console.error(`Em dashes found in site copy (${real.length}):\n` + real.join('\n'));
	process.exit(1);
}
console.log(`no em dashes in ${files.length} user-facing files`);
