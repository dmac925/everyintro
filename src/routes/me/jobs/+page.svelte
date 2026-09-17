<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Matched roles | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Roles that fit you</h1>
		<p class="text-muted">Public listings picked for you each Monday. These link to the company's own application page.</p>
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
</div>
