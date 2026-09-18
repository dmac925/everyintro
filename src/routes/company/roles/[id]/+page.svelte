<script lang="ts">
	import { enhance } from '$app/forms';
	import MatchCard from '$lib/components/MatchCard.svelte';
	import RoleSpecCard from '$lib/components/RoleSpecCard.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { HIRE_PRICE_PENCE, QUESTION_MAX_CHARS, ROLE_LIVE_DAYS } from '$lib/config';

	let { data, form } = $props();

	const ref = (matchId: string) => matchId.slice(0, 4).toUpperCase();
	const stages = $derived([
		['Shortlist', data.shortlist.total, 'scored and waiting for you'],
		['Asked', data.pipeline.asked.length, 'intro requested'],
		['Talking', data.pipeline.talking.length, 'accepted, contact shared'],
		['Hired', data.pipeline.hired.length, 'recorded and paid']
	] as const);
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
	{#if form?.asked}<p class="rounded-md bg-good-soft px-4 py-2 text-sm text-good" role="status">Question handled: {form.notice}</p>{/if}

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

	{#if data.role.status !== 'draft'}
		<!-- Pipeline (issue #10): one board, driven by intro status. -->
		<nav class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Pipeline">
			{#each stages as [label, count, note] (label)}
				<a href="#stage-{label.toLowerCase()}" class="panel block py-3 hover:border-ink">
					<p class="label">{label}</p>
					<p class="mt-0.5 font-display text-[30px] leading-none tabular-nums">{count}</p>
					<p class="text-xs text-muted">{note}</p>
				</a>
			{/each}
		</nav>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
		<section class="space-y-4">
			<h2 id="stage-shortlist" class="text-[24px] leading-[1.15]">Shortlist</h2>
			{#if data.role.status === 'open' && !data.role.lastMatchedAt}
				<p class="panel text-muted">Matching in progress. This usually takes under a minute.</p>
			{/if}
			{#if data.cards.length > 1 && data.role.status === 'open'}
				<!-- Batch question (issue #14): one question, every visible card. -->
				<details class="panel">
					<summary class="cursor-pointer text-sm font-semibold">Ask all {data.cards.length} shown candidates a question</summary>
					<form method="POST" action="?/ask" use:enhance class="mt-3 space-y-2">
						{#each data.cards as match (match.matchId)}<input type="hidden" name="matchId" value={match.matchId} />{/each}
						<label for="batch-question" class="sr-only">Question</label>
						<textarea id="batch-question" name="text" rows="2" maxlength={QUESTION_MAX_CHARS} required class="field" placeholder="e.g. How much of your last role was hands-on design rather than managing?"></textarea>
						<div class="flex flex-wrap items-center gap-2">
							<button class="btn">Ask {data.cards.length} candidates</button>
							<span class="text-xs text-muted">Answered from their profiles where possible; otherwise sent to them. Questions that could identify someone aren't sent.</span>
						</div>
					</form>
				</details>
			{/if}
			{#each data.cards as match (match.matchId)}
				<MatchCard {match} canAsk={data.role.status === 'open'} />
			{:else}
				{#if data.role.status === 'open' && data.role.lastMatchedAt}
					<p class="panel text-muted">No strong matches yet. We re-check weekly as new candidates join. Fewer cards beats weak ones.</p>
				{/if}
			{/each}
			{#if data.shortlist.total > data.shortlist.visible}
				<div class="flex flex-wrap items-center gap-3">
					<a href="?show={data.shortlist.visible + data.shortlist.page}#stage-shortlist" class="btn-ghost">Show {Math.min(data.shortlist.page, data.shortlist.total - data.shortlist.visible)} more</a>
					<span class="text-xs text-muted">{data.shortlist.visible} of {data.shortlist.total} shown. Cards below the usual cutoff are labelled "weaker".</span>
				</div>
			{/if}

			{#if data.requestedCards.length}
				<h2 id="stage-asked" class="pt-4 text-[24px] leading-[1.15]">Asked</h2>
				<p class="text-sm text-muted">Intro requested. They have until the expiry to answer, and you'll get an email either way.</p>
				{#each data.requestedCards as match (match.matchId)}<MatchCard {match} />{/each}
			{/if}

			{#if data.pipeline.talking.length}
				<h2 id="stage-talking" class="pt-4 text-[24px] leading-[1.15]">Talking</h2>
				<div class="table-wrap">
					<table>
						<thead><tr><th>Candidate</th><th>Fit</th><th>Accepted</th><th></th></tr></thead>
						<tbody>
							{#each data.pipeline.talking as i (i.id)}
								<tr>
									<td><span class="font-semibold">{i.candidate_name ?? 'Candidate ' + ref(i.match_id)}</span> <a href="mailto:{i.candidate_email}" class="text-accent hover:underline">{i.candidate_email}</a></td>
									<td class="tabular-nums">{i.fit} / 5</td>
									<td class="text-muted">{i.responded_at?.slice(0, 10) ?? ''}</td>
									<td>
										<form method="POST" action="/company/intros?/hired">
											<input type="hidden" name="introId" value={i.id} />
											<button class="btn btn-sm">Mark as hired · £{HIRE_PRICE_PENCE / 100}</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if data.pipeline.hired.length}
				<h2 id="stage-hired" class="pt-4 text-[24px] leading-[1.15]">Hired</h2>
				<ul class="panel divide-y divide-rule text-sm">
					{#each data.pipeline.hired as i (i.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 py-2"><span class="font-semibold">{i.candidate_name ?? 'Candidate ' + ref(i.match_id)}</span><span class="pill bg-good-soft text-good">Hired {i.hired_at?.slice(0, 10)}</span></li>
					{/each}
				</ul>
			{/if}

			{#if data.pipeline.closed.length}
				<details class="pt-2 text-sm">
					<summary class="cursor-pointer font-semibold text-muted">Closed ({data.pipeline.closed.length}): declined or expired</summary>
					<ul class="mt-2 space-y-1 text-muted">
						{#each data.pipeline.closed as i (i.id)}
							<li>Candidate {ref(i.match_id)} · {i.status}{i.decline_reason ? `: ${i.decline_reason}` : ''} · {(i.responded_at ?? i.requested_at).slice(0, 10)}</li>
						{/each}
					</ul>
				</details>
			{/if}
		</section>
		<aside>
			<RoleSpecCard spec={data.spec} summary={data.role.summary} />
		</aside>
	</div>
</div>
