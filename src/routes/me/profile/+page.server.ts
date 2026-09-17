import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { first, run } from '$lib/server/db';
import { loadCandidateProfile, saveCandidateProfile } from '$lib/server/intake/drafts';
import { dispatch } from '$lib/server/jobs/dispatch';
import { deleteVectors } from '$lib/server/embeddings';
import { deleteClerkUser, revokeSession } from '$lib/server/auth';
import { WorkMode } from '$lib/schemas';
import type { CandidateRow } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const row = await first<Pick<CandidateRow, 'status' | 'blind_summary'>>(
		env.DB,
		'SELECT status, blind_summary FROM candidates WHERE user_id = ?',
		user.id
	);
	return {
		profile: await loadCandidateProfile(env, { userId: user.id }),
		blindSummary: row?.blind_summary ?? null,
		status: row?.status ?? 'onboarding'
	};
};

const lines = (v: FormDataEntryValue | null) =>
	String(v ?? '')
		.split(/\n|,/)
		.map((s) => s.trim())
		.filter(Boolean);
const int = (v: FormDataEntryValue | null) => {
	const n = parseInt(String(v ?? '').replace(/[£,\s]/g, ''), 10);
	return Number.isFinite(n) ? n : null;
};

export const actions: Actions = {
	save: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		const form = await request.formData();
		const workMode = WorkMode.safeParse(form.get('work_mode'));
		const rtw = form.get('right_to_work_uk');

		const profile = await loadCandidateProfile(env, { userId: user.id });
		const next = {
			...profile,
			target_titles: lines(form.get('target_titles')),
			salary_floor_gbp: int(form.get('salary_floor_gbp')),
			location: String(form.get('location') ?? '').trim() || null,
			work_mode: workMode.success ? workMode.data : null,
			notice_weeks: int(form.get('notice_weeks')),
			right_to_work_uk: rtw === 'yes' ? true : rtw === 'no' ? false : null,
			wants: lines(form.get('wants')),
			dealbreakers: lines(form.get('dealbreakers'))
		};
		if (next.target_titles.length === 0) return fail(400, { message: 'Add at least one job title.' });

		await saveCandidateProfile(env, { userId: user.id }, next);
		platform?.context?.waitUntil(dispatch(env, { type: 'embed_candidate', candidateId: user.id }));
		return { saved: true };
	},

	pause: async ({ locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		await run(getEnv(platform).DB, `UPDATE candidates SET status = 'paused' WHERE user_id = ?`, user.id);
	},

	resume: async ({ locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		await run(
			getEnv(platform).DB,
			`UPDATE candidates SET status = CASE WHEN blind_summary IS NULL THEN 'onboarding' ELSE 'active' END,
				last_active_at = datetime('now') WHERE user_id = ?`,
			user.id
		);
	},

	// Deletes the user and, via ON DELETE CASCADE, their profile, chats,
	// matches, intros and digest picks, then the Clerk account behind it.
	delete: async ({ locals, url, platform, cookies }) => {
		const user = requireUser(locals, url, 'candidate');
		const env = getEnv(platform);
		await deleteVectors(env, 'candidate', [user.id]);
		await run(env.DB, 'DELETE FROM users WHERE id = ?', user.id);
		await revokeSession(locals.auth().sessionId, cookies);
		await deleteClerkUser(user.id);
		redirect(303, '/');
	}
};
