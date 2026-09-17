<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const band = (min: number | null, max: number | null) =>
		min != null && max != null ? `£${min.toLocaleString('en-GB')}–£${max.toLocaleString('en-GB')}` : 'Salary not set';
	const statusClass: Record<string, string> = {
		requested: 'bg-accent-soft text-accent',
		accepted: 'bg-good-soft text-good',
		declined: 'bg-sunk text-muted',
		expired: 'bg-sunk text-muted'
	};
</script>

<svelte:head><title>Intro requests | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Intro requests</h1>
		<p class="text-muted">Companies that want to talk to you. They only see your name and email if you accept.</p>
	</div>
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

	{#each data.intros as intro (intro.id)}
		<article class="panel space-y-3">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<p class="font-display text-[22px] leading-tight">{intro.role_title ?? 'Untitled role'}</p>
					<p class="text-sm text-muted">{intro.company_name} · {band(intro.salary_min, intro.salary_max)} · {[intro.work_mode, intro.location].filter(Boolean).join(', ')}</p>
				</div>
				<span class="pill capitalize {statusClass[intro.status]}">{intro.hired_at ? 'Hired' : intro.status}</span>
			</div>
			{#if intro.role_summary}<p class="text-sm">{intro.role_summary}</p>{/if}
			{#if intro.why.length}
				<div>
					<p class="label mb-1">Why you matched</p>
					<ul class="list-disc pl-5 text-sm">{#each intro.why as w (w)}<li>{w}</li>{/each}</ul>
				</div>
			{/if}
			{#if intro.status === 'requested'}
				<div class="flex flex-wrap items-center gap-2">
					<form method="POST" action="?/accept" use:enhance>
						<input type="hidden" name="introId" value={intro.id} />
						<button class="btn">Accept and share my name and email</button>
					</form>
					<form method="POST" action="?/decline" use:enhance class="flex items-center gap-2">
						<input type="hidden" name="introId" value={intro.id} />
						<label for="decline-{intro.id}" class="sr-only">Reason</label>
						<select id="decline-{intro.id}" name="reason" class="field w-auto py-1.5">
							<option value="">No thanks. Why? (optional)</option>
							<option>Salary too low</option>
							<option>Wrong kind of role</option>
							<option>Location / work pattern</option>
							<option>Not looking right now</option>
						</select>
						<button class="btn-ghost">Decline</button>
					</form>
				</div>
				<p class="text-xs text-muted">Expires {intro.expires_at.slice(0, 10)}</p>
			{/if}
		</article>
	{:else}
		<p class="panel text-muted">No intro requests yet. When a company wants to talk to you, it'll appear here and we'll email you.</p>
	{/each}
</div>
