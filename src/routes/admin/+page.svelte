<script lang="ts">
	let { data } = $props();
	const gbp = (n: number) => `£${n.toFixed(n < 1 ? 3 : 2)}`;
	const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
	const tiles = $derived([
		['Candidates', data.counts.candidates],
		['Active', data.counts.activeCandidates],
		['Companies', data.counts.companies],
		['Open roles', data.counts.openRoles],
		['Intros', data.counts.intros],
		['Accepted', data.counts.acceptedIntros],
		['Public jobs', data.counts.publicJobs]
	] as const);
</script>

<svelte:head><title>Admin | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Admin</h1>
		<p class="text-sm text-muted">
			AI mode: <span class="font-mono">{data.mode}</span> · today {gbp(data.todayGbp)}{data.budgetGbp ? ` of £${data.budgetGbp} budget` : ', no daily cap'}
		</p>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
		{#each tiles as [label, value] (label)}
			<div class="panel p-4">
				<p class="label">{label}</p>
				<p class="mt-1 font-display text-[28px] leading-none tabular-nums">{value}</p>
			</div>
		{/each}
	</div>

	<section class="space-y-2">
		<div class="flex items-baseline justify-between">
			<h2 class="text-[24px] leading-[1.15]">AI spend, last 30 days</h2>
			<p class="font-display text-xl font-bold tabular-nums">{gbp(data.totalGbp)}</p>
		</div>
		<p class="text-sm text-muted">Estimated from logged token counts at list price. Check against the Anthropic console.</p>
		<div class="table-wrap">
			<table class="w-full text-sm">
				<thead>
					<tr>
						<th class="">Purpose</th>
						<th class="">Model</th>
						<th class=" text-right">Calls</th>
						<th class=" text-right">Input</th>
						<th class=" text-right">Cache read</th>
						<th class=" text-right">Output</th>
						<th class=" text-right">Cost</th>
						<th class=" text-right">Per call</th>
					</tr>
				</thead>
				<tbody class=" tabular-nums">
					{#each data.usage as u (u.purpose + u.model)}
						<tr>
							<td class="px-4 py-2">{u.purpose}</td>
							<td class="px-4 py-2 font-mono text-xs">{u.model}</td>
							<td class="px-4 py-2 text-right">{u.calls}</td>
							<td class="px-4 py-2 text-right">{k(u.input)}</td>
							<td class="px-4 py-2 text-right">{k(u.cache_read)}</td>
							<td class="px-4 py-2 text-right">{k(u.output)}</td>
							<td class="px-4 py-2 text-right">{gbp(u.gbp)}</td>
							<td class="px-4 py-2 text-right">{gbp(u.perCall)}</td>
						</tr>
					{:else}
						<tr><td colspan="8" class="px-4 py-6 text-center text-muted">No AI calls logged yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
