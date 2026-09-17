import type { Env } from './env';
import { EMBED_MODEL } from '../config';

// Workers AI embeddings + one Vectorize index. Vector ids are prefixed by kind
// (c: candidate, r: role, j: public job) and carry `kind` metadata so queries
// can filter. Both bindings are optional in local dev — callers must handle
// `vectorsAvailable(env) === false` by skipping the vector step.

export type VectorKind = 'candidate' | 'role' | 'job';
const PREFIX: Record<VectorKind, string> = { candidate: 'c:', role: 'r:', job: 'j:' };

export function vectorsAvailable(env: Env): env is Env & { AI: Ai; VECTORIZE: VectorizeIndex } {
	return env.VECTOR_SEARCH !== 'false' && Boolean(env.AI && env.VECTORIZE);
}

export async function embed(env: Env & { AI: Ai }, texts: string[]): Promise<number[][]> {
	const out = (await env.AI.run(EMBED_MODEL, { text: texts })) as { data: number[][] };
	return out.data;
}

export async function upsertVectors(
	env: Env & { AI: Ai; VECTORIZE: VectorizeIndex },
	kind: VectorKind,
	items: { id: string; text: string }[]
) {
	if (items.length === 0) return;
	const vectors = await embed(env, items.map((i) => i.text.slice(0, 4000)));
	await env.VECTORIZE.upsert(
		items.map((item, i) => ({ id: PREFIX[kind] + item.id, values: vectors[i], metadata: { kind } }))
	);
}

/** Nearest neighbours of `text` among vectors of `kind`. Returns raw ids (prefix stripped). */
export async function nearest(
	env: Env & { AI: Ai; VECTORIZE: VectorizeIndex },
	text: string,
	kind: VectorKind,
	topK: number
): Promise<string[]> {
	const [vector] = await embed(env, [text.slice(0, 4000)]);
	const res = await env.VECTORIZE.query(vector, { topK: Math.min(topK, 100), filter: { kind } });
	return res.matches.map((m) => m.id.slice(PREFIX[kind].length));
}

/** Best-effort: a failed vector delete must never block deleting the DB rows. */
export async function deleteVectors(env: Env, kind: VectorKind, ids: string[]) {
	if (!vectorsAvailable(env) || ids.length === 0) return;
	try {
		await env.VECTORIZE.deleteByIds(ids.map((id) => PREFIX[kind] + id));
	} catch (err) {
		console.error(`deleteVectors(${kind}) failed`, err);
	}
}
