<script lang="ts">
	import { HIRE_PRICE_PENCE } from '$lib/config';
	let { data } = $props();
</script>

<svelte:head><title>Billing | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Billing</h1>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="panel">
			<p class="label">Roles opened</p>
			<p class="mt-1 font-display text-[36px] leading-none tabular-nums">{data.rolesOpened}</p>
		</div>
		<div class="panel">
			<p class="label">Hires</p>
			<p class="mt-1 font-display text-[36px] leading-none tabular-nums text-good">{data.hires} <span class="text-base text-muted">at £{HIRE_PRICE_PENCE / 100} each</span></p>
		</div>
	</div>
	<p class="text-sm text-muted">Roles and intros are free. You pay once per hire, recorded from the intros page.</p>

	<div class="table-wrap">
		<table class="w-full text-sm">
			<thead>
				<tr><th class="">Date</th><th class="">Role</th><th class="">Hire</th><th class=" text-right">Amount</th><th class="">Status</th></tr>
			</thead>
			<tbody class="">
				{#each data.payments as p (p.id)}
					<tr>
						<td class="px-4 py-3 text-muted">{p.created_at.slice(0, 10)}</td>
						<td class="px-4 py-3">{p.role_title ?? 'Untitled role'}</td>
						<td class="px-4 py-3">{p.candidate_name ?? '·'}</td>
						<td class="px-4 py-3 text-right tabular-nums">£{(p.amount_pence / 100).toFixed(2)}</td>
						<td class="px-4 py-3 capitalize">{p.status}</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-4 py-6 text-center text-muted">No payments yet. Nothing is due until you hire.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<!-- TODO(billing): VAT invoices / receipts via Stripe. -->
</div>
