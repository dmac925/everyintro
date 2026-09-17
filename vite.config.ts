import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Same shape as strata/companytrack: Svelte config inline, runes forced on for
// project code, Cloudflare adapter. In `vite dev` the adapter emulates the
// bindings declared in wrangler.jsonc (D1 locally; AI/Vectorize need --remote
// and are optional — see src/lib/server/env.ts).
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			version: { pollInterval: 60_000 }
		})
	]
});
