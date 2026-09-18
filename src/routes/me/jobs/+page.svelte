<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const band = (min: number | null, max: number | null) =>
		min != null && max != null ? `£${min.toLocaleString('en-GB')} to £${max.toLocaleString('en-GB')}` : 'Salary not set';
</script>

<svelte:head><title>Roles that fit you | EveryIntro</title></svelte:head>

<div class="space-y-10">
	<section class="space-y-4">
		<div>
			<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Roles that fit you</h1>
			<p class="text-muted">Roles on EveryIntro where the matcher put you on the shortlist. Say you're interested and the company sees a badge on your anonymous card. Your name stays hidden until you accept an intro.</p>
		</div>
		{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

		{#each data.matched as m (m.match_id)}
			<article class="panel space-y-3">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<div>
						<p class="font-display text-[22px] leading-tight">{m.title ?? 'Untitled role'}</p>
						<p class="text-sm text-muted">{m.company_name} · {band(m.salary_min, m.salary_max)} · {[m.work_mode, m.location].filter(Boolean).join(', ')}</p>
					</div>
					<span class="pill {m.fit >= 4 ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}">Fit {m.fit} / 5</span>
				</div>
				{#if m.summary}<p class="text-sm">{m.summary}</p>{/if}
				<dl class="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
					<dt class="label pt-0.5">Why you fit</dt>
					<dd><ul class="list-disc pl-4">{#each m.why as w (w)}<li>{w}</li>{:else}<li class="text-muted">No notes</li>{/each}</ul></dd>
					<dt class="label pt-0.5">Gaps</dt>
					<dd class="text-warn"><ul class="list-disc pl-4">{#each m.gaps as g (g)}<li>{g}</li>{:else}<li>None obvious</li>{/each}</ul></dd>
				</dl>
				<div class="flex flex-wrap items-center gap-2">
					{#if m.intro_status}
						<a href="/me/intros" class="btn-ghost">Intro {m.intro_status}: see it</a>
					{:else if m.interested_at}
						<span class="pill bg-amber-soft text-amber-ink">You said you're interested</span>
						<form method="POST" action="?/withdraw" use:enhance>
							<input type="hidden" name="matchId" value={m.match_id} />
							<button class="btn-ghost">Withdraw</button>
						</form>
					{:else}
						<form method="POST" action="?/interest" use:enhance>
							<input type="hidden" name="matchId" value={m.match_id} />
							<button class="btn">I'd be interested</button>
						</form>
						<span class="text-xs text-muted">Still anonymous. The company can then ask for an intro.</span>
					{/if}
				</div>
			</article>
		{:else}
			<p class="panel text-muted">Nothing on the platform yet. As companies open roles that fit your profile, they appear here and you can raise a hand.</p>
		{/each}
	</section>

	<section class="space-y-4">
		<div>
			<h2 class="text-[28px] leading-[1.1] lg:text-[32px]">Public listings picked for you</h2>
			<p class="text-muted">Sent each Monday. These link to the company's own application page.</p>
		</div>
		<ul class="space-y-3">
			{#each data.jobs as job (job.id)}
				<li class="panel flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="font-semibold">{job.title}</p>
						<p class="text-sm text-muted">{job.company_name}{job.location ? ` · ${job.location}` : ''}</p>
						<p class="mt-1 text-sm">{job.why}</p>
					</div>
					<div class="flex items-center gap-2">
						<span class="pill bg-good-soft text-good">Fit {job.fit}/5</span>
						<a href={job.url} target="_blank" rel="noopener noreferrer" class="btn-ghost py-1.5">View role</a>
					</div>
				</li>
			{:else}
				<li class="panel text-muted">Nothing yet. Your first digest arrives the Monday after your profile is complete.</li>
			{/each}
		</ul>
	</section>
</div>
