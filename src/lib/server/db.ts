// Thin helpers over D1. Keep SQL in the calling module so each query sits next
// to the logic that needs it.

export const newId = () => crypto.randomUUID();

export async function first<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
	return db.prepare(sql).bind(...params).first<T>();
}

export async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
	const { results } = await db.prepare(sql).bind(...params).all<T>();
	return results;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]) {
	return db.prepare(sql).bind(...params).run();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

/** SQLite datetime string `days` from now (negative for the past). */
export function sqlDate(days: number): string {
	return new Date(Date.now() + days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}
