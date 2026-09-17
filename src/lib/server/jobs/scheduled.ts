import type { Env, JobMessage } from '../env';
import { DIGEST_ACTIVE_DAYS, DIGEST_MAX_CANDIDATES_PER_RUN, PUBLIC_JOB_STALE_DAYS, REMATCH_MIN_DAYS } from '../../config';
import { all, run, sqlDate } from '../db';
import { deleteVectors } from '../embeddings';
import { dispatchMany } from './dispatch';

// Cron entry points, called from workers/jobs. Each only does cheap SQL and
// fans real work out to the queue, one message per unit.

/** Daily: housekeeping, public job ingest, and weekly-at-most rematches. */
export async function daily(env: Env) {
	await run(env.DB, `UPDATE intros SET status = 'expired' WHERE status = 'requested' AND expires_at < datetime('now')`);
	await run(env.DB, `UPDATE roles SET status = 'expired' WHERE status = 'open' AND expires_at < datetime('now')`);

	const stale = await all<{ id: string }>(
		env.DB,
		'SELECT id FROM public_jobs WHERE last_seen_at < ?',
		sqlDate(-PUBLIC_JOB_STALE_DAYS)
	);
	if (stale.length) {
		await deleteVectors(env, 'job', stale.map((s) => s.id));
		await run(env.DB, 'DELETE FROM public_jobs WHERE last_seen_at < ?', sqlDate(-PUBLIC_JOB_STALE_DAYS));
	}

	const sources = await all<{ source: string; board: string }>(env.DB, 'SELECT source, board FROM job_sources WHERE enabled = 1');
	const roles = await all<{ id: string }>(
		env.DB,
		`SELECT id FROM roles WHERE status = 'open' AND (last_matched_at IS NULL OR last_matched_at < ?)`,
		sqlDate(-REMATCH_MIN_DAYS)
	);

	const messages: JobMessage[] = [
		...sources.map((s) => ({ type: 'ingest_source' as const, source: s.source, board: s.board })),
		...roles.map((r) => ({ type: 'match_role' as const, roleId: r.id }))
	];
	await dispatchMany(env, messages);
}

/** Weekly: digest for recently active candidates, capped (skip, don't fail). */
export async function weekly(env: Env) {
	const candidates = await all<{ user_id: string }>(
		env.DB,
		`SELECT user_id FROM candidates
		 WHERE status = 'active' AND blind_summary IS NOT NULL AND last_active_at > ?
		 ORDER BY last_active_at DESC LIMIT ?`,
		sqlDate(-DIGEST_ACTIVE_DAYS),
		DIGEST_MAX_CANDIDATES_PER_RUN
	);
	if (candidates.length === DIGEST_MAX_CANDIDATES_PER_RUN) {
		console.warn(`digest capped at ${DIGEST_MAX_CANDIDATES_PER_RUN} candidates — raise the cap deliberately if spend allows`);
	}
	await dispatchMany(env, candidates.map((c) => ({ type: 'digest_candidate' as const, candidateId: c.user_id })));
}
