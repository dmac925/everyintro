import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guards';
import { getEnv } from '$lib/server/platform';
import { first } from '$lib/server/db';
import type { CandidateRow } from '$lib/types';

export const load: LayoutServerLoad = async ({ locals, url, platform }) => {
	const user = requireUser(locals, url, 'candidate');
	const env = getEnv(platform);
	const candidate = await first<Pick<CandidateRow, 'status' | 'blind_summary'>>(
		env.DB,
		'SELECT status, blind_summary FROM candidates WHERE user_id = ?',
		user.id
	);
	return { candidateStatus: candidate?.status ?? 'onboarding' };
};
