import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnv } from '$lib/server/platform';
import { requireUser } from '$lib/server/guards';
import { all } from '$lib/server/db';
import { answerQuestion, declineQuestion } from '$lib/server/questions';
import type { QuestionStatus } from '$lib/types';

// Questions from companies that shortlisted this candidate. Answers go back
// onto the anonymous card; the candidate's name stays hidden.
export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const rows = await all<{
		id: string;
		status: QuestionStatus;
		sent_text: string | null;
		answer: string | null;
		created_at: string;
		answered_at: string | null;
		role_title: string | null;
		company_name: string;
	}>(
		env.DB,
		`SELECT q.id, q.status, q.sent_text, q.answer, q.created_at, q.answered_at, r.title AS role_title, c.name AS company_name
		 FROM questions q JOIN roles r ON r.id = q.role_id JOIN companies c ON c.id = q.company_id
		 WHERE q.candidate_id = ? AND q.status IN ('sent', 'answered', 'declined')
		 ORDER BY q.status = 'sent' DESC, q.created_at DESC`,
		user.id
	);
	return { pending: rows.filter((q) => q.status === 'sent'), past: rows.filter((q) => q.status !== 'sent') };
};

export const actions: Actions = {
	answer: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const form = await request.formData();
		const ok = await answerQuestion(getEnv(platform), user.id, String(form.get('questionId')), String(form.get('answer') ?? ''));
		return ok ? { answered: true } : fail(400, { message: 'Write a short answer, or decline.' });
	},
	decline: async ({ request, locals, url, platform }) => {
		const user = requireUser(locals, url, 'candidate');
		const form = await request.formData();
		const ok = await declineQuestion(getEnv(platform), user.id, String(form.get('questionId')));
		return ok ? { declined: true } : fail(400, { message: 'That question is no longer open.' });
	}
};
