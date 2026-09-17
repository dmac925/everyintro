<script lang="ts">
	import FeeCalculator from '$lib/components/FeeCalculator.svelte';
	import { BRAND, COMPETITORS } from '$lib/brand';
	import { CARDS_PER_ROLE, HIRE_PRICE_PENCE, HIRE_REFUND_DAYS, ROLE_LIVE_DAYS } from '$lib/config';

	const ai = COMPETITORS.aiRecruiter;
	const price = HIRE_PRICE_PENCE / 100;

	const steps = [
		['Brief the agent', 'Paste a job description or just talk. It pins down at most five real must-haves, a salary band and your process, and pushes back on wish lists.'],
		['Get a shortlist that explains itself', `Up to ${CARDS_PER_ROLE} anonymous cards. Each says why the person fits, where the gaps are, and what they want. Fewer cards beats padded ones.`],
		['Warm intros, both sides consenting', 'Request an intro. The candidate sees the role and salary band and says yes or no. Only then do you get their name and email.']
	];
	const why = [
		['Because it costs pounds, not thousands', 'An intake chat and a match run cost us a few pounds in AI and hosting. Percentage fees were priced on what the market would bear, not on cost. We price on cost.'],
		['Because a flat fee changes the incentive', 'A percentage rewards the recruiter for the biggest placement. A flat fee per hire rewards us for showing you the right person quickly, whatever they’re paid, and getting out of the way.'],
		['Because you can check', 'The matching code and prompts are open source (AGPL-3.0). If you’d rather run it yourself, you can.'],
		['Because there’s no lock-in to protect', 'No contract, no minimum, no exclusivity. Post a role, or don’t.']
	];
	const faqs = [
		['What if I don’t hire from the shortlist?', `Then you pay nothing. Roles are free to post and stay live for ${ROLE_LIVE_DAYS} days with unlimited intros. The £${price} is only due when you hire someone you met through an intro.`],
		['How do you know I hired someone?', 'You tell us. Mark the intro as hired on your intros page and pay by card. It’s an honour system, priced low enough that it isn’t worth gaming.'],
		['What if the hire doesn’t work out?', `Full refund if they leave or are let go within ${HIRE_REFUND_DAYS} days. Email us from the intros page and we return the £${price}, no forms.`],
		['Can recruitment agencies use it?', 'No. Companies are verified by work-email domain, and candidates are anonymous until they accept. There’s nothing for an agency to harvest.'],
		['How big is the candidate pool?', 'Small. We’re new and UK-only. We’d rather tell you that than pad the shortlist. If there’s no strong match for a role yet, you’ll see fewer cards, and we re-check weekly as people join.'],
		['Does it integrate with my ATS?', 'Not yet. Intros arrive by email; you run your process however you like.']
	];
</script>

<svelte:head><title>For employers | {BRAND}</title></svelte:head>

<article class="space-y-14 lg:space-y-20">
	<header class="max-w-[760px]">
		<p class="eyebrow">For employers</p>
		<h1 class="mt-3 text-[40px] leading-[1.05] lg:text-[60px]">Everything an AI recruiter does. <em class="text-amber-ink">Nothing taken from the salary.</em></h1>
		<p class="mt-5 max-w-[560px] text-[17px] leading-relaxed text-body text-pretty lg:text-lg">
			Brief the agent, get a shortlist with reasons, warm-intro the people who want to talk. Roles are free to post. A flat £{price} when you hire, whatever the salary. No percentage, no retainer, no contract.
		</p>
		<a href="/post" class="btn-amber mt-7">Post a role free</a>
		<p class="mt-3 text-[13px] text-muted">Takes under five minutes. Paste a job description or describe the role and company and we'll generate a job description for you.</p>
	</header>

	<section>
		<h2 class="max-w-[640px] text-[32px] leading-[1.1] lg:text-[44px]">The same shape of product, priced like software.</h2>
		<p class="mt-3 max-w-[600px] text-[15px] leading-normal text-body lg:text-base">
			If you've looked at other AI recruiters, this will feel familiar. That's deliberate. The parts that work, we kept. The {ai.feePct}%-of-salary success fee, we didn't.
		</p>
		<div class="ledger mt-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:border-b lg:border-b-rule-2">
			{#each steps as [title, body], i (title)}
				<div class="ledger-row">
					<p class="ledger-num">0{i + 1}</p>
					<div class="lg:mt-[18px]">
						<h3 class="mt-0.5 font-sans text-[17px] font-bold leading-snug tracking-normal lg:text-xl">{title}</h3>
						<p class="mt-1.5 text-[15px] leading-normal text-body text-pretty lg:text-base">{body}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">What one hire costs</h2>
		<div class="mt-6"><FeeCalculator /></div>
	</section>

	<section>
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">Why we can charge £{price}</h2>
		<div class="mt-6 grid gap-3 sm:grid-cols-2">
			{#each why as [title, body] (title)}
				<div class="panel">
					<h3 class="font-sans text-[17px] font-bold leading-snug tracking-normal">{title}</h3>
					<p class="mt-1.5 text-[15px] leading-normal text-body">{body}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="max-w-[760px]">
		<h2 class="text-[32px] leading-[1.1] lg:text-[44px]">Straight answers</h2>
		<dl class="mt-4 divide-y divide-rule-2 border-t-2 border-ink">
			{#each faqs as [q, a] (q)}
				<div class="py-4">
					<dt class="text-[17px] font-bold leading-snug">{q}</dt>
					<dd class="mt-1.5 text-[15px] leading-normal text-body">{a}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<div>
		<a href="/post" class="btn-amber">Post a role free</a>
		<p class="mt-3 text-[13px] text-muted">Takes under five minutes. Nothing to pay until you hire.</p>
	</div>
</article>
