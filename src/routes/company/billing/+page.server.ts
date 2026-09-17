import type { PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireCompany, requireUser } from '$lib/server/guards';
import { all, first } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'employer');
	const env = getEnv(platform);
	const company = await requireCompany(env, user);
	// Candidate name only through an accepted intro (a hire is always one).
	const payments = await all<{ id: string; role_title: string | null; candidate_name: string | null; amount_pence: number; status: string; created_at: string }>(
		env.DB,
		`SELECT b.id, r.title AS role_title, b.amount_pence, b.status, b.created_at,
			CASE WHEN i.status = 'accepted' THEN u.name END AS candidate_name
		 FROM billing_events b
		 JOIN roles r ON r.id = b.role_id
		 LEFT JOIN intros i ON i.id = b.intro_id
		 LEFT JOIN users u ON u.id = i.candidate_id
		 WHERE b.company_id = ? ORDER BY b.created_at DESC`,
		company.id
	);
	const hires = await first<{ n: number }>(env.DB, 'SELECT count(*) AS n FROM intros WHERE company_id = ? AND hired_at IS NOT NULL', company.id);
	return { rolesOpened: company.roles_opened, hires: hires?.n ?? 0, payments };
};
