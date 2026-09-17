import type { Env, JobMessage } from '../env';
import { handleJob } from './handlers';

/**
 * Hand work to the jobs worker via Queues. In local dev (INLINE_JOBS="true" or
 * no queue binding) run it in-process instead so nothing needs a second worker.
 */
export async function dispatch(env: Env, message: JobMessage): Promise<void> {
	if (env.INLINE_JOBS === 'true' || !env.JOBS_QUEUE) {
		try {
			await handleJob(env, message);
		} catch (err) {
			console.error(`inline job ${message.type} failed`, err);
		}
		return;
	}
	await env.JOBS_QUEUE.send(message);
}

export async function dispatchMany(env: Env, messages: JobMessage[]): Promise<void> {
	if (env.INLINE_JOBS === 'true' || !env.JOBS_QUEUE) {
		for (const m of messages) await dispatch(env, m);
		return;
	}
	for (let i = 0; i < messages.length; i += 100) {
		await env.JOBS_QUEUE.sendBatch(messages.slice(i, i + 100).map((body) => ({ body })));
	}
}
