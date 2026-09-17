// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="@cloudflare/workers-types" />
/// <reference types="svelte-clerk/env" />
import type { Env } from '$lib/server/env';
import type { User } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			user: User | null; // our row for the Clerk session, once registered
		}
		interface Platform {
			env: Env;
			context: ExecutionContext;
		}
	}
}

export {};
