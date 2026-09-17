// EveryIntro background worker: cron triggers + queue consumer. Shares all its
// logic with the app via src/lib/server (relative imports only there).

import type { Env, JobMessage } from '../../../src/lib/server/env';
import { handleJob } from '../../../src/lib/server/jobs/handlers';
import { daily, weekly } from '../../../src/lib/server/jobs/scheduled';

export default {
	async scheduled(controller, env, ctx) {
		// Keep these in sync with the "crons" in wrangler.jsonc.
		if (controller.cron === '0 5 * * *') ctx.waitUntil(daily(env));
		else if (controller.cron === '0 6 * * 1') ctx.waitUntil(weekly(env));
	},

	async queue(batch, env) {
		for (const msg of batch.messages) {
			try {
				await handleJob(env, msg.body);
				msg.ack();
			} catch (err) {
				console.error(`job ${msg.body.type} failed (attempt ${msg.attempts})`, err);
				msg.retry({ delaySeconds: 60 * msg.attempts });
			}
		}
	}
} satisfies ExportedHandler<Env, JobMessage>;
