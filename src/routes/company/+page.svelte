<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { HIRE_PRICE_PENCE, ROLE_LIVE_DAYS } from '$lib/config';

	let { data, form } = $props();
</script>

<svelte:head><title>Roles | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="label">{data.company.name}{data.company.verified_at ? '' : ' · unverified'}</p>
			<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Roles</h1>
		</div>
		<form method="POST" action="?/createRole">
			<button class="btn">New role</button>
		</form>
	</div>
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

	<p class="panel text-sm">
		<span class="font-semibold text-good">Roles are free to open</span> and stay live for {ROLE_LIVE_DAYS} days with unlimited intros. £{HIRE_PRICE_PENCE / 100} when you hire someone through an intro, nothing otherwise.
	</p>

	<div class="table-wrap">
		<table class="w-full text-sm">
			<thead>
				<tr>
					<th class="">Role</th>
					<th class="">Status</th>
					<th class=" text-right">New matches</th>
					<th class=" text-right">Intros requested</th>
					<th class="">Expires</th>
				</tr>
			</thead>
			<tbody class="">
				{#each data.roles as role (role.id)}
					<tr>
						<td class="px-4 py-3"><a class="font-medium text-accent hover:underline" href="/company/roles/{role.id}">{role.title ?? 'Untitled role'}</a></td>
						<td class="px-4 py-3"><StatusPill status={role.status} /></td>
						<td class="px-4 py-3 text-right tabular-nums">{role.shown}</td>
						<td class="px-4 py-3 text-right tabular-nums">{role.requested}</td>
						<td class="px-4 py-3 text-muted">{role.expires_at?.slice(0, 10) ?? 'Not set'}</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-4 py-6 text-center text-muted">No roles yet. Start with "New role", it's a short chat.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
