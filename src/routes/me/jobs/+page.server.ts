import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { all } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const jobs = await all<{
		id: string;
		title: string;
		company_name: string;
		location: string | null;
		url: string;
		fit: number;
		why: string;
		created_at: string;
	}>(
		env.DB,
		`SELECT j.id, j.title, j.company_name, j.location, j.url, d.fit, d.why, d.created_at
		 FROM digest_items d JOIN public_jobs j ON j.id = d.job_id
		 WHERE d.candidate_id = ?
		 ORDER BY d.created_at DESC, d.fit DESC
		 LIMIT 100`,
		user.id
	);
	return { jobs };
};
