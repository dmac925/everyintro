import type { Env } from '../env';
import type { RoleRow } from '../../types';
import { all } from '../db';

// Step 1: hard filters in SQL. Anything a candidate or employer has said is
// non-negotiable is enforced here, before any AI sees the pool.
//
// Candidates already matched to this role (shown, passed or requested) are
// excluded, so re-runs only rerank *new* people — that keeps weekly refreshes cheap.
// TODO(matching): re-consider candidates whose profile_version changed since.
// TODO(matching): location distance for onsite/hybrid (currently left to rerank).

const COMPATIBLE_MODES: Record<string, string[]> = {
	onsite: ['onsite', 'hybrid', 'any'],
	hybrid: ['hybrid', 'onsite', 'any'],
	remote: ['remote', 'hybrid', 'onsite', 'any'],
	any: ['onsite', 'hybrid', 'remote', 'any']
};

export async function filterCandidates(env: Env, role: RoleRow): Promise<string[]> {
	const modes = COMPATIBLE_MODES[role.work_mode ?? 'any'] ?? COMPATIBLE_MODES.any;
	const rows = await all<{ user_id: string }>(
		env.DB,
		`SELECT c.user_id FROM candidates c
		 WHERE c.status = 'active' AND c.blind_summary IS NOT NULL
		   AND (c.salary_floor IS NULL OR ?1 IS NULL OR c.salary_floor <= ?1)
		   AND (?2 = 1 OR c.right_to_work_uk = 1)
		   AND (c.work_mode IS NULL OR c.work_mode IN (SELECT value FROM json_each(?3)))
		   AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.role_id = ?4 AND m.candidate_id = c.user_id)
		 ORDER BY c.last_active_at DESC
		 LIMIT 2000`,
		role.salary_max,
		role.sponsorship ?? 0,
		JSON.stringify(modes),
		role.id
	);
	return rows.map((r) => r.user_id);
}
