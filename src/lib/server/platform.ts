import { error } from '@sveltejs/kit';
import type { Env } from './env';

// App-only (imports @sveltejs/kit) — not for use from workers/jobs.
export function getEnv(platform: App.Platform | undefined): Env {
	const env = platform?.env;
	if (!env?.DB) error(500, 'D1 binding "DB" is missing. Check wrangler.jsonc and run `npm run db:migrate:local`.');
	return env;
}
