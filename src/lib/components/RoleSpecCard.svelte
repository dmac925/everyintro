<script lang="ts">
	import type { RoleSpec } from '$lib/schemas';

	let { spec, summary = null }: { spec: RoleSpec; summary?: string | null } = $props();

	const band = $derived(
		spec.salary_min_gbp != null && spec.salary_max_gbp != null
			? `£${spec.salary_min_gbp.toLocaleString('en-GB')}–£${spec.salary_max_gbp.toLocaleString('en-GB')}`
			: 'Not set'
	);
</script>

<div class="panel space-y-4">
	<div>
		<p class="label">Role</p>
		<p class="font-display text-[22px] leading-tight">{spec.title ?? 'Untitled role'}</p>
		{#if summary}<p class="mt-1 text-sm text-muted">{summary}</p>{/if}
	</div>

	<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
		<div><dt class="label">Salary band</dt><dd>{band}</dd></div>
		<div><dt class="label">Work</dt><dd>{spec.work_mode ?? 'Not set'}{spec.office_days_per_week != null ? `, ${spec.office_days_per_week} days` : ''}</dd></div>
		<div><dt class="label">Location</dt><dd>{spec.location ?? 'Not set'}</dd></div>
		<div><dt class="label">Sponsorship</dt><dd>{spec.sponsorship == null ? 'Not set' : spec.sponsorship ? 'Yes' : 'No'}</dd></div>
	</dl>

	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<p class="label mb-1">Must-haves</p>
			<ul class="list-disc pl-5 text-sm">
				{#each spec.must_haves as m (m)}<li>{m}</li>{:else}<li class="list-none text-muted">Not set</li>{/each}
			</ul>
		</div>
		<div>
			<p class="label mb-1">Nice-to-haves</p>
			<ul class="list-disc pl-5 text-sm">
				{#each spec.nice_to_haves as m (m)}<li>{m}</li>{:else}<li class="list-none text-muted">Not set</li>{/each}
			</ul>
		</div>
	</div>

	{#if spec.interview_stages.length}
		<div>
			<p class="label mb-1">Interview process</p>
			<p class="text-sm">{spec.interview_stages.join(' → ')}</p>
		</div>
	{/if}
</div>
