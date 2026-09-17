<script lang="ts">
	import type { CandidateProfile } from '$lib/schemas';

	// The full profile as a card (profile page, homepage preview).
	let { profile }: { profile: CandidateProfile } = $props();

	const gbp = (n: number | null) => (n == null ? 'Not set' : `£${n.toLocaleString('en-GB')}`);
	const yesNo = (b: boolean | null) => (b == null ? 'Not set' : b ? 'Yes' : 'No');
	const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Not set');
</script>

<div class="panel space-y-5">
	<div>
		<p class="label">Looking for</p>
		<p class="mt-1 font-display text-[26px] leading-tight">{profile.target_titles.join(' · ') || 'Not set yet'}</p>
		{#if profile.seniority || profile.years_experience != null}
			<p class="mt-1 text-sm text-muted">
				{[profile.seniority && cap(profile.seniority), profile.years_experience != null && `${profile.years_experience} yrs`].filter(Boolean).join(' · ')}
			</p>
		{/if}
	</div>

	<dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px] sm:grid-cols-4">
		<div><dt class="label">Salary floor · private</dt><dd class="mt-0.5 font-semibold">{gbp(profile.salary_floor_gbp)}</dd></div>
		<div><dt class="label">Location</dt><dd class="mt-0.5 font-semibold">{profile.location ?? 'Not set'}</dd></div>
		<div><dt class="label">Work mode</dt><dd class="mt-0.5 font-semibold">{cap(profile.work_mode)}</dd></div>
		<div><dt class="label">Notice</dt><dd class="mt-0.5 font-semibold">{profile.notice_weeks != null ? `${profile.notice_weeks} weeks` : 'Not set'}</dd></div>
		<div><dt class="label">UK right to work</dt><dd class="mt-0.5 font-semibold">{yesNo(profile.right_to_work_uk)}</dd></div>
	</dl>

	{#if profile.skills.length}
		<div>
			<p class="label mb-1.5">Skills, with evidence</p>
			<ul class="space-y-1.5 text-[15px]">
				{#each profile.skills as s (s.skill)}
					<li><span class="font-semibold">{s.skill}</span> <span class="text-body">: {s.evidence}</span></li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<p class="label mb-1.5">Wants</p>
			<ul class="list-disc pl-5 text-[15px] text-body">
				{#each profile.wants as w (w)}<li>{w}</li>{:else}<li class="list-none text-muted">Not set</li>{/each}
			</ul>
		</div>
		<div>
			<p class="label mb-1.5">Dealbreakers</p>
			<ul class="list-disc pl-5 text-[15px] text-body">
				{#each profile.dealbreakers as d (d)}<li>{d}</li>{:else}<li class="list-none text-muted">Not set</li>{/each}
			</ul>
		</div>
	</div>
</div>
