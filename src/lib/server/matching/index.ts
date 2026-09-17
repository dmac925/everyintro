import type { Env } from '../env';
import type { CandidateRow, RoleRow } from '../../types';
import { modelFor } from '../claude';
import { all, first, newId, run } from '../db';
import { filterCandidates } from './filters';
import { shortlist } from './shortlist';
import { rerank } from './rerank';
import { candidateFacts, factsText, roleText } from './facts';
import { upsertVectors, vectorsAvailable } from '../embeddings';

/**
 * Full pipeline for one open role: hard filters → vector shortlist → Claude
 * rerank → upsert matches. Incremental: only candidates never matched to this
 * role are considered, so re-runs cost little when few new people joined.
 */
export async function runMatchForRole(env: Env, roleId: string): Promise<{ considered: number; scored: number }> {
	const role = await first<RoleRow>(env.DB, 'SELECT * FROM roles WHERE id = ?', roleId);
	if (!role || role.status !== 'open') return { considered: 0, scored: 0 };

	await ensureRoleEmbedding(env, role);

	const survivors = await filterCandidates(env, role);
	const ids = await shortlist(env, role, survivors);
	if (ids.length === 0) {
		await run(env.DB, `UPDATE roles SET last_matched_at = datetime('now') WHERE id = ?`, roleId);
		return { considered: 0, scored: 0 };
	}

	const rows = await all<CandidateRow>(
		env.DB,
		`SELECT * FROM candidates WHERE user_id IN (SELECT value FROM json_each(?))`,
		JSON.stringify(ids)
	);
	const scores = await rerank(
		env,
		roleId,
		roleText(role),
		rows.map((r) => ({ id: r.user_id, blindSummary: r.blind_summary ?? '', facts: factsText(candidateFacts(r)) }))
	);

	const runId = newId();
	const stmt = env.DB.prepare(
		`INSERT INTO matches (id, role_id, candidate_id, fit, why_json, gaps_json, run_id, model)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (role_id, candidate_id) DO UPDATE SET
			fit = excluded.fit, why_json = excluded.why_json, gaps_json = excluded.gaps_json,
			run_id = excluded.run_id, model = excluded.model, updated_at = datetime('now')
		 WHERE matches.status = 'shown'`
	);
	await env.DB.batch([
		...scores.map((s) =>
			stmt.bind(newId(), roleId, s.candidateId, s.fit, JSON.stringify(s.why), JSON.stringify(s.gaps), runId, modelFor(env))
		),
		env.DB.prepare(`UPDATE roles SET last_matched_at = datetime('now') WHERE id = ?`).bind(roleId)
	]);
	return { considered: ids.length, scored: scores.length };
}

async function ensureRoleEmbedding(env: Env, role: RoleRow) {
	if (!vectorsAvailable(env) || role.embedded_version >= role.spec_version) return;
	try {
		await upsertVectors(env, 'role', [{ id: role.id, text: roleText(role) }]);
		await run(env.DB, 'UPDATE roles SET embedded_version = ? WHERE id = ?', role.spec_version, role.id);
	} catch (err) {
		console.error('role embedding failed', err);
	}
}

export async function embedCandidate(env: Env, candidateId: string) {
	if (!vectorsAvailable(env)) return;
	const row = await first<CandidateRow>(env.DB, 'SELECT * FROM candidates WHERE user_id = ?', candidateId);
	if (!row?.blind_summary || row.embedded_version >= row.profile_version) return;
	const text = `${factsText(candidateFacts(row))}\n${row.blind_summary}`;
	await upsertVectors(env, 'candidate', [{ id: candidateId, text }]);
	await run(env.DB, 'UPDATE candidates SET embedded_version = ? WHERE user_id = ?', row.profile_version, candidateId);
}
