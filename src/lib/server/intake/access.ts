import { error } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import type { Env } from '../env';
import type { ConversationRow, User } from '../../types';
import { first } from '../db';
import { ANON_COOKIE } from './conversations';

/**
 * Resolve a conversation the caller may write to: their own (signed in), or
 * an anonymous one whose token is in their cookie. 404 otherwise.
 */
export async function ownedConversation(env: Env, id: string, user: User | null, cookies: Cookies): Promise<ConversationRow> {
	const convo = await first<ConversationRow>(env.DB, 'SELECT * FROM conversations WHERE id = ?', id);
	if (!convo) error(404, 'Conversation not found.');
	const owns = convo.user_id ? user?.id === convo.user_id : Boolean(convo.anon_token && cookies.get(ANON_COOKIE) === convo.anon_token);
	if (!owns) error(404, 'Conversation not found.');
	return convo;
}

/** NDJSON stream of IntakeEvents from an async producer. */
export function eventStream(produce: (emit: (e: unknown) => void) => Promise<void>): Response {
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const emit = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
			try {
				await produce(emit);
			} finally {
				controller.close();
			}
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' }
	});
}
