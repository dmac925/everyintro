<script lang="ts">
	import { enhance } from '$app/forms';
	import type { MatchCardData } from '$lib/types';

	import { QUESTION_MAX_CHARS } from '$lib/config';

	// Blind candidate card shown to employers. No name, contact or salary floor.
	let { match, canAsk = false }: { match: MatchCardData; canAsk?: boolean } = $props();

	const qStatus: Record<string, { label: string; cls: string }> = {
		answered_by_agent: { label: 'From their profile', cls: 'bg-teal-soft text-teal' },
		sent: { label: 'Asked, waiting', cls: 'bg-accent-soft text-accent' },
		answered: { label: 'Answered', cls: 'bg-good-soft text-good' },
		declined: { label: 'Declined', cls: 'bg-sunk text-muted' },
		refused: { label: 'Not sent', cls: 'bg-warn-soft text-warn' },
		pending: { label: 'Checking', cls: 'bg-sunk text-muted' }
	};

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
		<div class="flex flex-wrap items-center gap-1.5">
			{#if match.interested}<span class="pill bg-amber-soft text-amber-ink" title="The candidate saw this role and said they'd be interested">Interested</span>{/if}
			{#if match.weak}
				<span class="pill bg-warn-soft text-warn">Fit {match.fit} / 5 · weaker</span>
			{:else}
				<span class="pill bg-good-soft text-good">Fit {match.fit} / 5</span>
			{/if}
		</div>
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

	{#if match.questions.length}
		<div class="space-y-2 rounded-2xl bg-ground p-3 text-sm">
			<p class="label">Questions</p>
			{#each match.questions as q (q.id)}
				<div class="space-y-0.5">
					<p class="flex flex-wrap items-baseline gap-2"><span class="font-medium">{q.text}</span><span class="pill {qStatus[q.status].cls}">{qStatus[q.status].label}</span></p>
					{#if q.answer}<p class="text-body">{q.answer}</p>{/if}
					{#if q.reason}<p class="text-xs text-warn">{q.reason}</p>{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if canAsk && (match.status === 'shown' || match.status === 'requested')}
		<details class="text-sm">
			<summary class="cursor-pointer font-semibold text-muted hover:text-ink">Ask a question</summary>
			<form method="POST" action="?/ask" use:enhance class="mt-2 space-y-2">
				<input type="hidden" name="matchId" value={match.matchId} />
				<label for="q-{match.matchId}" class="sr-only">Question</label>
				<textarea id="q-{match.matchId}" name="text" rows="2" maxlength={QUESTION_MAX_CHARS} required class="field" placeholder="Something the card doesn't tell you. Nothing that would identify them."></textarea>
				<button class="btn btn-sm">Ask</button>
			</form>
		</details>
	{/if}

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
