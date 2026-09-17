<script lang="ts">
	import { BRAND } from '$lib/brand';
	import { HIRE_PRICE_PENCE, HIRE_REFUND_DAYS } from '$lib/config';

	const instead = [
		['A flat fee that covers our costs', `Roles and intros are free. £${HIRE_PRICE_PENCE / 100} when you hire, whatever the salary, refunded if they leave within ${HIRE_REFUND_DAYS} days. That’s it, no percentage, no retainer, no contract.`],
		['Built for the candidate too', 'Candidates never pay, are anonymous until they say yes, see every reason they were matched, and can leave with all their data at any time. A service that only serves employers isn’t fixing hiring, it’s just automating it.'],
		['Open source', 'The matching logic is public, AGPL-licensed, and anyone can inspect it or run it themselves. We’d rather be judged on our code than on our marketing.'],
		['Honest about fit', 'Every shortlist shows the gaps as well as the reasons. If there’s no strong match, we show fewer cards rather than padding the list.']
	];
</script>

<svelte:head><title>Our mission | {BRAND}</title></svelte:head>

<article class="max-w-[760px] space-y-12 lg:space-y-16">
	<header>
		<p class="eyebrow">Mission</p>
		<h1 class="mt-3 text-[40px] leading-[1.05] lg:text-[60px]">The best person in the best role, <em class="text-amber-ink">and nobody taking a cut of it.</em></h1>
		<p class="mt-5 text-[17px] leading-relaxed text-body text-pretty lg:text-lg">
			Hiring is the most important market most people will ever take part in, and the money in it flows the wrong way.
		</p>
	</header>

	<section class="space-y-4 text-[16px] leading-relaxed text-body lg:text-[17px]">
		<h2 class="text-[30px] leading-[1.1] text-ink lg:text-[40px]">Who a percentage fee actually serves</h2>
		<p>
			When a recruiter, human or AI, is paid a slice of the salary, three things quietly happen. The recruiter is rewarded for the <em class="text-ink">biggest</em> placement, not the <em class="text-ink">right</em> one. The company has £6,000–£12,000 less to pay the person they just hired. And the candidate never sees any of it, even though it was their salary the fee was calculated on.
		</p>
		<p>
			AI made sourcing and matching cheap. The percentage model survived anyway, because it was never priced on cost. It was priced on what the market would bear. We don't think a company should be locked into paying 10% of a person's first-year salary for what a good AI agent can do for a few pounds.
		</p>
	</section>

	<section>
		<h2 class="text-[30px] leading-[1.1] lg:text-[40px]">What we do instead</h2>
		<div class="ledger mt-5">
			{#each instead as [title, body], i (title)}
				<div class="ledger-row lg:grid lg:grid-cols-[56px_1fr] lg:border-b lg:border-b-rule-2 lg:py-[18px]">
					<p class="ledger-num lg:text-[40px]">0{i + 1}</p>
					<div>
						<h3 class="mt-0.5 font-sans text-[17px] font-bold leading-snug tracking-normal">{title}</h3>
						<p class="mt-1.5 text-[15px] leading-normal text-body text-pretty">{body}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="text-[30px] leading-[1.1] lg:text-[40px]">Where we are</h2>
		<p class="mt-4 text-[16px] leading-relaxed text-body lg:text-[17px]">
			{BRAND} is new and UK-only. We don't have a network of hundreds of thousands of candidates yet, but we have a better deal for the ones who join, and for the companies who'd rather spend their hiring budget on the hire.
		</p>
	</section>

	<div class="flex flex-wrap gap-2.5">
		<a href="/sign-in?as=employer" class="btn">Post a role free</a>
		<a href="/chat" class="btn-amber">Join as a candidate</a>
	</div>
</article>
