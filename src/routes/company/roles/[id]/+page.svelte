<script lang="ts">
	import { enhance } from '$app/forms';
	import MatchCard from '$lib/components/MatchCard.svelte';
	import RoleSpecCard from '$lib/components/RoleSpecCard.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { HIRE_PRICE_PENCE, ROLE_LIVE_DAYS } from '$lib/config';

	let { data, form } = $props();
</script>

<svelte:head><title>{data.spec.title ?? 'Role'} | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<a href="/company" class="text-sm text-muted hover:text-ink">← Roles</a>
			<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">{data.spec.title ?? 'Untitled role'}</h1>
			<div class="mt-1 flex items-center gap-2 text-sm text-muted">
				<StatusPill status={data.role.status} />
				{#if data.role.expiresAt}<span>Live until {data.role.expiresAt.slice(0, 10)}</span>{/if}
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<a href="/company/roles/{data.role.id}/intake" class="btn-ghost">Edit via chat</a>
			{#if data.role.status === 'open'}
				<form method="POST" action="?/refresh" use:enhance><button class="btn-ghost">Refresh matches</button></form>
				<form method="POST" action="?/close" use:enhance><button class="btn-ghost">Close role</button></form>
			{/if}
		</div>
	</div>

	{#if data.paid}<p class="rounded-md bg-good-soft px-4 py-2 text-sm text-good">Payment received. The role opens as soon as Stripe confirms.</p>{/if}
	{#if data.cancelled}<p class="rounded-md bg-warn-soft px-4 py-2 text-sm text-warn">Checkout cancelled. The role is still a draft.</p>{/if}
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}
	{#if form?.refreshing}<p class="text-sm text-good" role="status">Looking for new matches. Check back shortly.</p>{/if}

	{#if data.role.status === 'draft' || data.role.status === 'awaiting_payment'}
		<section class="panel space-y-3 border-accent bg-accent-soft">
			{#if data.missing.length}
				<p class="font-semibold">Before you can open this role</p>
				<p class="text-sm">Still needed: {data.missing.join(', ')}.</p>
				<a href="/company/roles/{data.role.id}/intake" class="btn">Continue the chat</a>
			{:else}
				<p class="font-semibold">Ready to open for matching</p>
				<p class="text-sm">Free to open. Live for {ROLE_LIVE_DAYS} days with unlimited intros. £{HIRE_PRICE_PENCE / 100} only if you hire someone through an intro.</p>
				<form method="POST" action="?/open" use:enhance>
					<button class="btn">Open role</button>
				</form>
			{/if}
		</section>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
		<section class="space-y-4">
			<h2 class="text-[24px] leading-[1.15]">Shortlist</h2>
			{#if data.role.status === 'open' && !data.role.lastMatchedAt}
				<p class="panel text-muted">Matching in progress. This usually takes under a minute.</p>
			{/if}
			{#each data.cards as match (match.matchId)}
				<MatchCard {match} />
			{:else}
				{#if data.role.status === 'open' && data.role.lastMatchedAt}
					<p class="panel text-muted">No strong matches yet. We re-check weekly as new candidates join. Fewer cards beats weak ones.</p>
				{/if}
			{/each}

			{#if data.requestedCards.length}
				<h2 class="pt-4 text-[24px] leading-[1.15]">Waiting on candidates</h2>
				{#each data.requestedCards as match (match.matchId)}<MatchCard {match} />{/each}
			{/if}
		</section>
		<aside>
			<RoleSpecCard spec={data.spec} summary={data.role.summary} />
		</aside>
	</div>
</div>
