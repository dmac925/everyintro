import type { Env } from '../env';
import type { RoleRow } from '../../types';
import { SHORTLIST_SIZE } from '../../config';
import { nearest, vectorsAvailable } from '../embeddings';

// Step 2: narrow the filtered pool to SHORTLIST_SIZE with vector similarity,
// so Claude only ever reranks a small set. If vectors aren't available (local
// dev without --remote) or fail, fall back to the most recently active.

export async function shortlist(env: Env, role: RoleRow, survivors: string[]): Promise<string[]> {
	if (survivors.length <= SHORTLIST_SIZE) return survivors;
	if (!vectorsAvailable(env)) return survivors.slice(0, SHORTLIST_SIZE);

	try {
		const query = [role.title, role.summary].filter(Boolean).join('\n');
		const nearestIds = await nearest(env, query, 'candidate', 100);
		const allowed = new Set(survivors);
		const ranked = nearestIds.filter((id) => allowed.has(id));
		const picked = new Set(ranked.slice(0, SHORTLIST_SIZE));
		for (const id of survivors) {
			if (picked.size >= SHORTLIST_SIZE) break;
			picked.add(id);
		}
		return [...picked];
	} catch (err) {
		console.error('vector shortlist failed, falling back to recency', err);
		return survivors.slice(0, SHORTLIST_SIZE);
	}
}
