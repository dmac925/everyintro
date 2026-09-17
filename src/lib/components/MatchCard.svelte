<script lang="ts">
	import { enhance } from '$app/forms';
	import type { MatchCardData } from '$lib/types';

	// Blind candidate card shown to employers. No name, contact or salary floor.
	let { match }: { match: MatchCardData } = $props();

	const chips = $derived(
		[
			match.facts.years != null && `${match.facts.years} yrs`,
			match.facts.seniority,
			[match.facts.location, match.facts.workMode].filter(Boolean).join(' · '),
			match.facts.noticeWeeks != null && `${match.facts.noticeWeeks} wks notice`,
			match.facts.rightToWorkUk && 'UK right to work'
		].filter(Boolean) as string[]
	);
</script>

<article class="panel space-y-3">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<div>
			<p class="font-mono text-xs text-muted">Candidate {match.ref}</p>
			<p class="font-display text-[22px] leading-tight">{match.facts.titles[0] ?? 'Candidate'}</p>
		</div>
		<span class="pill bg-good-soft text-good">Fit {match.fit} / 5</span>
	</div>

	{#if chips.length}
		<ul class="flex flex-wrap gap-1.5">
			{#each chips as chip (chip)}<li class="rounded bg-sunk px-2 py-0.5 text-xs">{chip}</li>{/each}
		</ul>
	{/if}

	<p class="text-sm">{match.summary}</p>

	<dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
		<dt class="label pt-0.5">Why</dt>
		<dd><ul class="list-disc pl-4">{#each match.why as w (w)}<li>{w}</li>{/each}</ul></dd>
		<dt class="label pt-0.5">Gaps</dt>
		<dd class="text-warn"><ul class="list-disc pl-4">{#each match.gaps as g (g)}<li>{g}</li>{:else}<li>None obvious</li>{/each}</ul></dd>
	</dl>

	{#if match.status === 'shown'}
		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="?/requestIntro" use:enhance>
				<input type="hidden" name="matchId" value={match.matchId} />
				<button class="btn">Request intro</button>
			</form>
			<form method="POST" action="?/pass" use:enhance class="flex items-center gap-2">
				<input type="hidden" name="matchId" value={match.matchId} />
				<label class="sr-only" for="reason-{match.matchId}">Reason</label>
				<select id="reason-{match.matchId}" name="reason" class="field w-auto py-1.5">
					<option value="">Not a fit. Why?</option>
					<option>Missing a must-have</option>
					<option>Too junior</option>
					<option>Too senior</option>
					<option>Location / work pattern</option>
					<option>Other</option>
				</select>
				<button class="btn-ghost">Pass</button>
			</form>
			<span class="text-xs text-muted">Their name and CV are shared only if they accept.</span>
		</div>
	{:else if match.status === 'requested'}
		<p class="text-sm text-muted">Intro requested, waiting for the candidate.</p>
	{/if}
</article>
