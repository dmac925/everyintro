<script lang="ts">
	import { HIRE_PRICE_PENCE, HIRE_REFUND_DAYS } from '$lib/config';

	let { data, form } = $props();

	const statusClass: Record<string, string> = {
		requested: 'bg-accent-soft text-accent',
		accepted: 'bg-good-soft text-good',
		declined: 'bg-sunk text-muted',
		expired: 'bg-sunk text-muted'
	};
</script>

<svelte:head><title>Intros | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Intros</h1>
		<p class="text-muted">Contact details appear once a candidate accepts. When you hire someone from here, mark it and pay the £{HIRE_PRICE_PENCE / 100} fee. Full refund if they leave within {HIRE_REFUND_DAYS} days.</p>
	</div>

	{#if data.paid}<p class="rounded-md bg-good-soft px-4 py-2 text-sm text-good">Payment received. The hire is recorded as soon as Stripe confirms.</p>{/if}
	{#if data.cancelled}<p class="rounded-md bg-warn-soft px-4 py-2 text-sm text-warn">Checkout cancelled. Nothing was recorded.</p>{/if}
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

	<div class="table-wrap">
		<table class="w-full text-sm">
			<thead>
				<tr>
					<th class="">Role</th>
					<th class="">Status</th>
					<th class="">Candidate</th>
					<th class="">Requested</th>
					<th class="">Hired</th>
				</tr>
			</thead>
			<tbody class="">
				{#each data.intros as intro (intro.id)}
					<tr>
						<td class="px-4 py-3"><a href="/company/roles/{intro.role_id}" class="text-accent hover:underline">{intro.role_title ?? 'Untitled role'}</a></td>
						<td class="px-4 py-3"><span class="pill capitalize {statusClass[intro.status]}">{intro.status}</span></td>
						<td class="px-4 py-3">
							{#if intro.candidate_email}
								{intro.candidate_name ?? ''} <a href="mailto:{intro.candidate_email}" class="text-accent hover:underline">{intro.candidate_email}</a>
							{:else if intro.status === 'declined'}
								<span class="text-muted">Declined{intro.decline_reason ? `: ${intro.decline_reason}` : ''}</span>
							{:else}
								<span class="text-muted">Hidden until accepted</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-muted">{intro.requested_at.slice(0, 10)}</td>
						<td class="px-4 py-3">
							{#if intro.hired_at}
								<span class="pill bg-good-soft text-good">Hired {intro.hired_at.slice(0, 10)}</span>
							{:else if intro.status === 'accepted'}
								<form method="POST" action="?/hired">
									<input type="hidden" name="introId" value={intro.id} />
									<button class="btn btn-sm">Mark as hired · £{HIRE_PRICE_PENCE / 100}</button>
								</form>
							{:else}
								<span class="text-muted">·</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-4 py-6 text-center text-muted">No intros yet. Request one from a role's shortlist.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
