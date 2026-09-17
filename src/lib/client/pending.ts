// The homepage starter hands the first message (or CV / LinkedIn URL) to the
// /chat page across a client-side navigation. In-memory on purpose: a File
// can't go in sessionStorage, and a hard reload simply lands on /chat with
// the greeting, which is fine.

export interface PendingAction {
	message?: string;
	file?: File;
	linkedin?: string;
}

let pending: PendingAction | null = null;

export function setPending(action: PendingAction) {
	pending = action;
}

/** Read-and-clear, so a refresh of /chat doesn't resend. */
export function takePending(): PendingAction | null {
	const p = pending;
	pending = null;
	return p;
}
