<script lang="ts">
	import FeeCalculator from '$lib/components/FeeCalculator.svelte';
	import { BRAND, COMPETITORS } from '$lib/brand';
	import { HIRE_PRICE_PENCE, HIRE_REFUND_DAYS, ROLE_LIVE_DAYS } from '$lib/config';

	const price = HIRE_PRICE_PENCE / 100;
	const ai = COMPETITORS.aiRecruiter;

	const rows: [string, string, string, string][] = [
		['Fee', `Flat £${price} per hire, whatever the salary`, `Typically a success fee, e.g. ${ai.feePct}% of ${ai.basis}`, `${COMPETITORS.agency.feePct}% of first-year salary (typ. 15–30%)`],
		['Paid when', 'A hire is made', 'A hire is made', 'A hire is made'],
		['Posting a role', 'Free, unlimited intros', 'Free', 'Free'],
		['Contract', 'None', 'Commercial agreement', 'Terms of business, often with exclusivity'],
		['If the hire leaves', `Full refund within ${HIRE_REFUND_DAYS} days`, 'Refund or rebate period, varies', 'Rebate period, varies'],
		['Candidates pay', 'Never', 'Never', 'Never'],
		['Intros are consent-based', 'Yes', 'Often', 'Usually not'],
		['Shows the gaps, not just the fit', 'Yes', 'Rarely', 'Not shown'],
		['Open source', 'Yes (AGPL-3.0)', 'Usually not', 'No'],
		['Candidate network', 'New, UK-only', 'Varies', 'Varies']
	];
</script>

<svelte:head><title>Pricing | {BRAND}</title></svelte:head>

<article class="space-y-14 lg:space-y-20">
	<header class="max-w-[760px]">
		<h1 class="text-[40px] leading-[1.05] lg:text-[60px]">Pricing</h1>
		<p class="mt-5 text-[17px] leading-relaxed text-body text-pretty lg:text-lg">
			Free for candidates. Free to post roles, live for {ROLE_LIVE_DAYS} days with unlimited intros. A flat £{price} when you hire, whatever the salary, refunded in full if they leave within {HIRE_REFUND_DAYS} days. That's the whole page. The rest is the comparison.
		</p>
	</header>

	<section class="ledger lg:grid lg:grid-cols-3 lg:gap-10 lg:border-b lg:border-b-rule-2">
		{#each [['Candidates', '£0', 'Everything, always.'], ['Employers · roles and intros', '£0', 'Intake, matching, unlimited intros.'], ['Employers · per hire', `£${price}`, 'Flat. No percentage, ever.']] as [who, amount, note] (who)}
			<div class="flex items-baseline justify-between gap-4 border-b border-rule-2 py-[18px] lg:block lg:border-b-0 lg:py-7">
				<div>
					<p class="label">{who}</p>
					<p class="mt-1 text-[15px] text-body">{note}</p>
				</div>
				<p class="font-display text-[40px] leading-none lg:mt-3 lg:text-[56px] {amount === '£0' ? 'text-teal' : 'text-ink'}">{amount}</p>
			</div>
		{/each}
	</section>

	<section>
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">Your hires, side by side</h2>
		<div class="mt-6"><FeeCalculator /></div>
	</section>

	<section>
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">How the models compare</h2>
		<div class="table-wrap mt-6">
			<table>
				<thead>
					<tr><th></th><th>{BRAND}</th><th>{ai.name}</th><th>{COMPETITORS.agency.name}</th></tr>
				</thead>
				<tbody>
					{#each rows as [label, ours, theirs, agency] (label)}
						<tr>
							<th scope="row" class="font-semibold tracking-normal text-ink normal-case">{label}</th>
							<td class="font-semibold">{ours}</td>
							<td class="text-body">{theirs}</td>
							<td class="text-body">{agency}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-xs leading-normal text-muted">
			AI recruiter fee from a leading AI recruiter's public pricing page, checked {ai.checked}. Other AI recruiter terms vary by provider. Agency figures are typical UK contingency terms, not a specific firm.
		</p>
	</section>

	<section class="max-w-[760px]">
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">Why not a success fee with a lower percentage?</h2>
		<p class="mt-4 text-[15px] leading-normal text-body lg:text-base">
			Because any percentage keeps the same incentives: the service is rewarded for the biggest placement, the company loses part of the salary budget, and the candidate never sees the money that was calculated on their pay. A flat fee per hire that covers running costs is the only model where both sides come out ahead.
		</p>
		<h3 class="mt-8 text-[22px] leading-[1.15] lg:text-[28px]">How do you know a hire happened?</h3>
		<p class="mt-3 text-[15px] leading-normal text-body lg:text-base">
			You tell us. Mark the intro as hired on your intros page and pay by card. It's an honour system, priced low enough that it isn't worth gaming.
		</p>
	</section>
</article>
