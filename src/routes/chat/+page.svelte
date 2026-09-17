<script lang="ts">
	import { untrack } from 'svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import ProfileProgress from '$lib/components/ProfileProgress.svelte';
	import { BRAND } from '$lib/brand';
	import { CANDIDATE_GREETING, HOME_GREETING } from '$lib/copy';
	import { takePending } from '$lib/client/pending';
	import type { CandidateProfile } from '$lib/schemas';

	let { data, form } = $props();

	// Live draft, seeded from the server and then updated from the chat stream.
	let profile = $state<CandidateProfile>(untrack(() => data.profile));
	let complete = $state(untrack(() => data.complete));

	// First message / CV / LinkedIn URL handed over by the homepage starter, if any.
	const pending = takePending();
	const greeting = untrack(() => (data.signedIn ? CANDIDATE_GREETING : HOME_GREETING));

	async function getEndpoint() {
		if (data.conversationId) return `/api/intake/${data.conversationId}`;
		const res = await fetch('/api/intake/start', { method: 'POST' });
		const body = (await res.json()) as { id?: string; message?: string };
		if (!res.ok || !body.id) throw new Error(body.message ?? 'Could not start a chat.');
		return `/api/intake/${body.id}`;
	}
</script>

<svelte:head><title>Your profile chat | {BRAND}</title></svelte:head>

<!--
	Design 3a/3b. Mobile: the profile strip sits in a dark band that continues
	the header; the chat runs on the cream ground with a white composer bar.
	Desktop: chat in a white card, profile building in a 400px column.
-->
<div class="bleed -mt-6 shrink-0 bg-ink px-5 pb-3.5 sm:-mt-10 sm:px-10 lg:hidden">
	<ProfileProgress {profile} {complete} variant="strip" signedIn={data.signedIn} />
</div>

{#if form?.message}<p class="mt-3 shrink-0 text-sm text-warn" role="alert">{form.message}</p>{/if}

<!-- Fills the rest of the viewport (the layout gives /chat a fixed height); nothing here makes the page scroll. -->
<div class="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)] lg:gap-10">
	<ChatPanel
		{getEndpoint}
		{greeting}
		initial={data.lines}
		{complete}
		initiallyGated={data.gated}
		allowImport
		gateNext="/chat"
		heightClass="min-h-0 flex-1 lg:h-full"
		{pending}
		autofocus={!pending}
		ondraft={(d) => (profile = d as CandidateProfile)}
		oncomplete={() => (complete = true)}
	/>
	<aside class="hidden min-h-0 lg:flex lg:flex-col">
		<ProfileProgress {profile} {complete} variant="card" signedIn={data.signedIn} />
		{#if data.signedIn}
			<form method="POST" action="?/restart" class="mt-2.5 shrink-0 text-right">
				<button class="text-sm font-semibold text-muted hover:text-ink">Start over</button>
			</form>
		{/if}
	</aside>
</div>
