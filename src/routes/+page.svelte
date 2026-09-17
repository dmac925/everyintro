<script lang="ts">
	import ChatStarter from '$lib/components/ChatStarter.svelte';
	import { BRAND, COMPETITORS } from '$lib/brand';
	import { HOME_GREETING } from '$lib/copy';
	import { HIRE_PRICE_PENCE } from '$lib/config';

	let { data } = $props();
	const ai = COMPETITORS.aiRecruiter;

	const reasons = [
		['Only roles that fit', 'Salary, location and how you want to work are enforced before any AI judgement. You see why you were matched.'],
		['You’re in control', 'Anonymous until you accept an intro: employers see what you’ve done and want, never your name or salary floor. Your data stays yours. See it, edit it, pause it, or delete it with one button.'],
		['On your side', 'We aren’t paid a slice of your salary, so there’s no reason to push you anywhere. The company keeps its budget for you.']
	];
</script>

<svelte:head>
	<title>{BRAND} | tell us what you want next</title>
	<meta name="description" content="A short chat instead of a CV. Only roles that fit, companies that have to ask before they see your name, and nobody taking a cut of your salary. Free for candidates." />
</svelte:head>

<!-- Design 1c / 2a: dark hero continues from the header; the agent card breaks out of it. -->
<section class="bleed -mt-6 bg-ink text-cream sm:-mt-10">
	<div class="container-x pt-[34px] pb-[110px] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-[72px] lg:pt-16 lg:pb-24">
		<div>
			<h1 class="text-[44px] leading-[1.05] tracking-[-0.02em] lg:text-[clamp(56px,4.9vw,68px)] lg:leading-[1.02] lg:tracking-[-0.025em]">
				Your intro to<br /><em class="text-amber">the right role.</em>
			</h1>
			<p class="mt-[18px] max-w-[520px] text-base leading-relaxed text-on-dark text-pretty lg:mt-[26px] lg:text-xl">
				A short chat you type, not a long AI voice call. Share as much or as little as you like. We only show you roles that fit, and nobody takes a cut of your salary.
			</p>
			<ul class="mt-[22px] flex flex-wrap gap-2 lg:mt-8 lg:gap-2.5">
				{#each ['CV or LinkedIn optional', 'No agents', 'Anonymous until you accept', 'You own your data'] as chip (chip)}
					<li class="rounded-full border border-ink-3 px-3 py-2 text-[12.5px] font-semibold text-on-dark-2 lg:px-3.5 lg:py-2.5 lg:text-[13px]">{chip}</li>
				{/each}
			</ul>
			{#if data.user?.kind === 'candidate'}
				<a href="/chat" class="pill-amber mt-6 h-11">Continue your chat →</a>
			{/if}
		</div>
		<div class="hidden lg:block"><ChatStarter greeting={HOME_GREETING} idPrefix="starter-lg" /></div>
	</div>
</section>

<div class="-mt-[86px] lg:hidden"><ChatStarter greeting={HOME_GREETING} idPrefix="starter" /></div>

<section class="pt-12 lg:pt-[88px]">
	<h2 class="max-w-[640px] text-[32px] leading-[1.1] tracking-[-0.015em] lg:text-[44px]">Built for the person looking, not the person paying.</h2>
	<div class="ledger mt-[22px] lg:mt-9 lg:grid lg:grid-cols-3 lg:gap-10 lg:border-b lg:border-b-rule-2">
		{#each reasons as [title, body], i (title)}
			<div class="ledger-row">
				<p class="ledger-num">0{i + 1}</p>
				<div class="lg:mt-[18px]">
					<h3 class="mt-0.5 font-sans text-[17px] font-bold leading-snug tracking-normal lg:text-xl">{title}</h3>
					<p class="mt-1.5 text-[15px] leading-normal text-body text-pretty lg:mt-2 lg:text-base">{body}</p>
				</div>
			</div>
		{/each}
	</div>
</section>

<section class="panel-ink mt-10 rounded-[20px] px-5 py-[22px] lg:mt-[72px] lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12 lg:rounded-3xl lg:px-11 lg:py-10">
	<div>
		<div class="flex flex-wrap items-baseline justify-between gap-x-[18px] gap-y-1 lg:justify-start">
			<h3 class="text-[28px] leading-[1.1] tracking-[-0.015em] lg:text-[40px]">Hiring?</h3>
			<p class="text-[13px] font-bold text-amber-ink lg:text-sm">Roles free · £{HIRE_PRICE_PENCE / 100} a hire</p>
		</div>
		<p class="mt-2.5 max-w-[560px] text-[15px] leading-normal text-body text-pretty lg:mt-3 lg:text-[17px]">
			Same AI agent for your side. A flat fee, not {ai.feePct}% of the salary like other AI recruiters or agencies.
		</p>
	</div>
	<div class="mt-[18px] flex flex-wrap gap-2 lg:mt-0 lg:gap-2.5">
		<a href="/employers" class="btn h-11 text-sm lg:h-12 lg:text-[15px]">How it works for employers</a>
		<a href="/pricing" class="btn-outline h-11 text-sm lg:h-12 lg:text-[15px]">Pricing</a>
	</div>
</section>
