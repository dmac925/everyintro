<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { ChatLine, ChoiceCard, IntakeEvent } from '$lib/types';
	import type { PendingAction } from '$lib/client/pending';

	// Streams one intake turn at a time from /api/intake/[id] (NDJSON events).
	// The conversation is resolved lazily on first use via `getEndpoint`, so an
	// anonymous visitor can start typing before anything exists server-side.
	//
	// Visual language (design 3a/3b): assistant turns are plain text with an
	// amber dot, user turns are ink bubbles, and hard-to-type answers arrive as
	// inline choice cards the user can tap instead of typing.
	let {
		getEndpoint,
		greeting,
		initial = [],
		complete = false,
		initiallyGated = false,
		allowImport = false,
		gateNext = '/chat',
		heightClass = 'h-[min(26rem,60svh)] sm:h-[min(32rem,75svh)]',
		pending = null,
		autofocus = false,
		ondraft,
		oncomplete
	}: {
		getEndpoint: () => Promise<string>;
		greeting: string;
		initial?: ChatLine[];
		complete?: boolean;
		initiallyGated?: boolean; // anonymous chat already past its free turns
		allowImport?: boolean; // show the "+" attach button (CV / LinkedIn)
		gateNext?: string; // where sign-in returns to after claiming the chat
		heightClass?: string;
		pending?: PendingAction | null; // first action carried over from the homepage starter
		autofocus?: boolean;
		ondraft?: (draft: unknown) => void;
		oncomplete?: () => void;
	} = $props();

	// Seeded once from props; the panel owns the transcript after mount.
	let lines = $state<ChatLine[]>(untrack(() => [{ role: 'assistant', text: greeting }, ...initial]));
	let input = $state('');
	let linkedin = $state('');
	let busy = $state(false);
	let gated = $state(untrack(() => initiallyGated));
	let error = $state<string | null>(null);
	let attachOpen = $state(false);
	let linkedInOpen = $state(false);
	let picked = $state<Record<number, number>>({}); // line index → chosen option index
	let endpoint: string | null = null;
	let scroller: HTMLDivElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let textarea: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		// Keep the latest message in view as text streams in.
		void lines.at(-1)?.text;
		void lines.at(-1)?.card;
		void gated;
		scroller?.scrollTo({ top: scroller.scrollHeight });
	});

	onMount(() => {
		// Carried over from the homepage: send it straight away so the reply is
		// already streaming when the page appears.
		if (pending?.message) sendText(pending.message);
		else if (pending?.file) importCv(pending.file);
		else if (pending?.linkedin) importLinkedInUrl(pending.linkedin);
		else if (autofocus) textarea?.focus();
	});

	async function resolveEndpoint() {
		return (endpoint ??= await getEndpoint());
	}

	function send(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text || busy) return;
		input = '';
		sendText(text);
	}

	async function sendText(text: string) {
		lines.push({ role: 'user', text });
		await stream(async (ep) =>
			fetch(ep, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text }) })
		);
	}

	/** Tapping a choice card sends the option's phrasing as if the user typed it. */
	function chooseAndSend(lineIndex: number, card: ChoiceCard) {
		const idx = picked[lineIndex];
		if (idx == null || busy) return;
		lines[lineIndex].cardDone = true;
		sendText(card.options[idx].send);
	}

	async function importCv(file: File) {
		attachOpen = false;
		const body = new FormData();
		body.append('cv', file);
		lines.push({ role: 'user', text: `📎 ${file.name}` });
		await stream(async (ep) => fetch(`${ep}/import`, { method: 'POST', body }));
	}

	function importLinkedIn(event: SubmitEvent) {
		event.preventDefault();
		const url = linkedin.trim();
		if (!url || busy) return;
		linkedin = '';
		linkedInOpen = attachOpen = false;
		importLinkedInUrl(url);
	}

	async function importLinkedInUrl(url: string) {
		const body = new FormData();
		body.append('linkedin_url', url);
		lines.push({ role: 'user', text: url });
		await stream(async (ep) => fetch(`${ep}/import`, { method: 'POST', body }));
	}

	/** Run one request that returns an IntakeEvent NDJSON stream into a new assistant bubble. */
	async function stream(request: (endpoint: string) => Promise<Response>) {
		error = null;
		busy = true;
		lines.push({ role: 'assistant', text: '' });
		const replyIndex = lines.length - 1;
		try {
			const res = await request(await resolveEndpoint());
			if (!res.ok || !res.body) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? `Request failed (${res.status})`);
			}
			const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				const parts = buffer.split('\n');
				buffer = parts.pop() ?? '';
				for (const part of parts) if (part.trim()) handle(JSON.parse(part) as IntakeEvent, replyIndex);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			if (!lines[replyIndex]?.text && !lines[replyIndex]?.card) lines.splice(replyIndex, 1);
			busy = false;
			if (!gated) textarea?.focus();
		}
	}

	function handle(e: IntakeEvent, replyIndex: number) {
		const reply = lines[replyIndex];
		if (e.type === 'text') reply.text += e.delta;
		else if (e.type === 'card') reply.card = e.card;
		else if (e.type === 'draft') ondraft?.(e.draft);
		else if (e.type === 'complete') oncomplete?.();
		else if (e.type === 'gate') gated = true;
		else if (e.type === 'error') error = e.message;
	}

	const confirmLabel = (card: ChoiceCard, idx: number | undefined) =>
		idx == null ? 'Pick one' : (card.confirm_template ?? 'Use {label}').replace('{label}', card.options[idx].label);
</script>

<section
	class="relative flex {heightClass} flex-col lg:overflow-hidden lg:rounded-3xl lg:border-[1.5px] lg:border-rule lg:bg-surface"
	aria-label="Chat"
>
	<div bind:this={scroller} class="flex flex-1 flex-col gap-4 overflow-y-auto pt-5 pb-4 lg:gap-[22px] lg:px-9 lg:pt-8" aria-live="polite">
		{#each lines as line, i (i)}
			{#if line.role === 'user'}
				<div class="max-w-[300px] self-end rounded-[18px] rounded-br-[4px] bg-ink px-4 py-3 text-[15px] leading-normal text-cream text-pretty whitespace-pre-wrap lg:max-w-[520px] lg:rounded-[20px] lg:rounded-br-[4px] lg:px-[18px] lg:py-3.5 lg:text-base">
					{line.text}
				</div>
			{:else}
				<div class="flex max-w-[640px] gap-2.5 lg:gap-3.5">
					<span class="mt-2 size-2 shrink-0 rounded-full bg-amber lg:mt-[9px]"></span>
					<div class="min-w-0 flex-1">
						<p class="text-[15px] leading-normal text-pretty whitespace-pre-wrap lg:text-base {i === 0 ? 'text-body' : 'text-ink'}">
							{line.text || (line.card ? '' : '…')}
						</p>
						{#if line.card}
							{@const card = line.card}
							<div class="mt-3 rounded-2xl border-[1.5px] border-rule bg-surface p-4 lg:rounded-[18px] lg:border-0 lg:bg-ground lg:p-5">
								<div class="flex items-baseline justify-between gap-3">
									<p class="text-[15px] font-bold lg:text-base">{card.title}</p>
									{#if card.private}
										<span class="label flex items-center gap-1.5"><span class="dot bg-muted"></span>Private</span>
									{/if}
								</div>
								{#if card.note}<p class="mt-1.5 mb-3 text-[13px] leading-snug text-muted lg:text-sm">{card.note}</p>{/if}
								<div class="flex flex-wrap items-center gap-2" role="group" aria-label={card.title}>
									{#each card.options as opt, j (opt.label)}
										<button
											type="button"
											class="chip {picked[i] === j ? 'chip-on' : ''}"
											aria-pressed={picked[i] === j}
											disabled={line.cardDone || busy}
											onclick={() => (picked[i] = j)}>{opt.label}</button
										>
									{/each}
									{#if card.other !== false}
										<button type="button" class="chip chip-other" disabled={line.cardDone || busy} onclick={() => textarea?.focus()}>Other</button>
									{/if}
									<button
										type="button"
										class="btn-amber mt-3 h-11 w-full text-sm lg:mt-0 lg:ml-auto lg:w-auto"
										disabled={line.cardDone || busy || picked[i] == null}
										onclick={() => chooseAndSend(i, card)}>{line.cardDone ? 'Done' : confirmLabel(card, picked[i])}</button
									>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		{#if gated}
			<!-- Anonymous chat: free turns used. Sign-in claims this conversation and its draft. -->
			<div class="mr-auto max-w-[360px] space-y-3 rounded-2xl border-[1.5px] border-amber bg-surface p-4">
				<p class="text-[15px] font-bold">Save your profile to keep going</p>
				<p class="text-[13px] leading-snug text-muted">Sign in with your email and everything you've said so far comes with you.</p>
				<a href="/sign-in?next={encodeURIComponent(gateNext)}&as=candidate" class="btn-amber h-11 w-full text-sm">Save and continue</a>
			</div>
		{/if}
	</div>

	{#if error}
		<p class="-mx-5 border-t border-rule bg-warn-soft px-5 py-2 text-sm text-warn sm:-mx-10 lg:mx-0" role="alert">{error}</p>
	{/if}

	<!-- Composer: full-bleed white bar on mobile, footer of the card on desktop. -->
	<div class="-mx-5 border-t border-rule bg-surface px-4 pt-3 pb-3.5 sm:-mx-10 sm:px-10 lg:mx-0 lg:px-6 lg:pt-4 lg:pb-5">
		{#if attachOpen && allowImport && !gated}
			<div class="mb-3 rounded-2xl border-[1.5px] border-rule bg-ground p-3" role="group" aria-label="Add to your profile">
				<div class="grid gap-2 sm:grid-cols-2">
					<button type="button" class="btn-ghost h-11 text-sm" disabled={busy} onclick={() => fileInput?.click()}>Upload CV (PDF)</button>
					<button type="button" class="btn-ghost h-11 text-sm" disabled={busy} aria-expanded={linkedInOpen} onclick={() => (linkedInOpen = !linkedInOpen)}>Import LinkedIn</button>
				</div>
				{#if linkedInOpen}
					<form onsubmit={importLinkedIn} class="mt-2 flex gap-2">
						<label for="linkedin-url" class="sr-only">LinkedIn profile URL</label>
						<input id="linkedin-url" bind:value={linkedin} type="url" placeholder="linkedin.com/in/you" class="field-white flex-1 py-2.5" disabled={busy} />
						<button class="btn btn-sm h-11" disabled={busy || !linkedin.trim()}>Import</button>
					</form>
				{/if}
			</div>
		{/if}
		<form onsubmit={send} class="flex items-end gap-2 lg:gap-2.5">
			{#if allowImport}
				<input
					bind:this={fileInput}
					id="cv-file"
					type="file"
					accept="application/pdf,.pdf,.txt,.md"
					class="sr-only"
					onchange={(e) => {
						const f = e.currentTarget.files?.[0];
						if (f) importCv(f);
						e.currentTarget.value = '';
					}}
				/>
				<button
					type="button"
					class="grid size-11 shrink-0 place-items-center rounded-btn border-[1.5px] border-rule bg-surface text-[22px] leading-none transition hover:border-ink lg:size-12 lg:text-2xl {attachOpen ? 'border-ink' : ''}"
					aria-label="Add a CV or LinkedIn profile"
					aria-expanded={attachOpen}
					disabled={busy || gated}
					onclick={() => (attachOpen = !attachOpen)}>+</button
				>
			{/if}
			<label for="chat-input" class="sr-only">Your message</label>
			<textarea
				id="chat-input"
				bind:this={textarea}
				bind:value={input}
				rows="1"
				class="field min-h-11 flex-1 resize-none py-3 leading-snug lg:min-h-12 lg:py-3.5 lg:text-base"
				placeholder={gated ? 'Enter your email above to continue' : complete ? 'Add anything else, or correct something…' : 'Or just type it…'}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						(e.currentTarget.form as HTMLFormElement).requestSubmit();
					}
				}}
				disabled={busy || gated}
			></textarea>
			<button class="btn h-11 w-11 shrink-0 px-0 text-lg lg:h-12 lg:w-auto lg:px-5 lg:text-[15px]" disabled={busy || gated || !input.trim()} aria-label="Send">
				<span class="hidden lg:inline">{busy ? 'Thinking…' : 'Send'}</span><span aria-hidden="true">↑</span>
			</button>
		</form>
		<div class="mt-2.5 flex items-center justify-between gap-3 text-xs font-medium text-muted lg:text-[13px]">
			<span>{allowImport ? '+ adds a CV (PDF) or LinkedIn profile' : ''}<span class="hidden lg:inline">{allowImport ? ' · ' : ''}Enter to send, Shift+Enter for a new line</span></span>
			<span class="flex items-center gap-1.5 lg:hidden"><span class="dot bg-teal"></span>Anonymous</span>
		</div>
	</div>
</section>
