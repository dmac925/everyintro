import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { all, first, parseJson, run } from '$lib/server/db';
import { sendEmail, templates } from '$lib/server/email';
import type { IntroStatus } from '$lib/types';

interface IntroView {
	id: string;
	status: IntroStatus;
	requested_at: string;
	expires_at: string;
	hired_at: string | null;
	role_title: string | null;
	role_summary: string | null;
	salary_min: number | null;
	salary_max: number | null;
	work_mode: string | null;
	location: string | null;
	company_name: string;
	why_json: string;
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const rows = await all<IntroView>(
		env.DB,
		`SELECT i.id, i.status, i.requested_at, i.expires_at, i.hired_at,
			r.title AS role_title, r.summary AS role_summary, r.salary_min, r.salary_max, r.work_mode, r.location,
			c.name AS company_name, m.why_json
		 FROM intros i
		 JOIN roles r ON r.id = i.role_id
		 JOIN companies c ON c.id = i.company_id
		 JOIN matches m ON m.id = i.match_id
		 WHERE i.candidate_id = ?
		 ORDER BY i.requested_at DESC`,
		user.id
	);
	return { intros: rows.map((r) => ({ ...r, why: parseJson<string[]>(r.why_json, []) })) };
};

export const actions: Actions = {
	accept: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		const id = String((await request.formData()).get('introId'));
		const intro = await first<{ id: string; company_id: string; role_title: string | null }>(
			env.DB,
			`SELECT i.id, i.company_id, r.title AS role_title FROM intros i JOIN roles r ON r.id = i.role_id
			 WHERE i.id = ? AND i.candidate_id = ? AND i.status = 'requested'`,
			id,
			user.id
		);
		if (!intro) return fail(404, { message: 'That intro is no longer open.' });

		await run(env.DB, `UPDATE intros SET status = 'accepted', responded_at = datetime('now') WHERE id = ?`, id);
		const members = await all<{ email: string }>(
			env.DB,
			'SELECT u.email FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = ?',
			intro.company_id
		);
		// TODO(intros): open a proper email thread between both parties.
		for (const m of members) {
			await sendEmail(env, { to: m.email, ...templates.introAccepted(env, intro.role_title ?? 'your role', user.name ?? user.email, user.email) });
		}
		return { accepted: true };
	},

	decline: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		const form = await request.formData();
		await run(
			env.DB,
			`UPDATE intros SET status = 'declined', decline_reason = ?, responded_at = datetime('now')
			 WHERE id = ? AND candidate_id = ? AND status = 'requested'`,
			String(form.get('reason') ?? '') || null,
			String(form.get('introId')),
			user.id
		);
		return { declined: true };
	}
};
