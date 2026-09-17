import type { Env, JobMessage } from '../env';
import { embedCandidate, runMatchForRole } from '../matching';
import { ingestSource } from './ingest';
import { digestCandidate } from './digest';

/** One queue message → one unit of work. Throw to let the queue retry. */
export async function handleJob(env: Env, message: JobMessage): Promise<void> {
	switch (message.type) {
		case 'match_role':
			await runMatchForRole(env, message.roleId);
			return;
		case 'embed_candidate':
			await embedCandidate(env, message.candidateId);
			return;
		case 'ingest_source':
			await ingestSource(env, message.source, message.board);
			return;
		case 'digest_candidate':
			await digestCandidate(env, message.candidateId);
			return;
	}
}
