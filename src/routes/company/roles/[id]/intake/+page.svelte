<script lang="ts">
	import { untrack } from 'svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import RoleSpecCard from '$lib/components/RoleSpecCard.svelte';
	import { ROLE_GREETING } from '$lib/copy';
	import type { RoleSpec } from '$lib/schemas';

	let { data } = $props();

	// Live draft, seeded from the server and then updated from the chat stream.
	let spec = $state<RoleSpec>(untrack(() => data.spec));
	let complete = $state(untrack(() => data.complete));
</script>

<svelte:head><title>Role intake | EveryIntro</title></svelte:head>

<div class="space-y-4">
	<div>
		<a href="/company/roles/{data.roleId}" class="text-sm text-muted hover:text-ink">← Role page</a>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Who are you looking for?</h1>
		<p class="text-muted">The spec fills in on the right as you chat.</p>
	</div>

	<div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
		<ChatPanel
			getEndpoint={async () => `/api/intake/${data.conversationId}`}
			greeting={ROLE_GREETING}
			initial={data.lines}
			{complete}
			ondraft={(d) => (spec = d as RoleSpec)}
			oncomplete={() => (complete = true)}
		/>
		<div class="space-y-3">
			{#if complete}
				<div class="panel space-y-2 border-good bg-good-soft">
					<p class="font-semibold text-good">Spec ready</p>
					<a href="/company/roles/{data.roleId}" class="btn">Review and open the role</a>
				</div>
			{/if}
			<RoleSpecCard {spec} />
		</div>
	</div>
</div>
