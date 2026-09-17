<script lang="ts">
	import { BRAND } from '$lib/brand';

	const reasons = [
		['Nobody’s paid a cut of your salary', 'When a recruiter takes 10–20% of your first-year pay, that’s money the company had for you. Here, the company pays a flat fee, and the rest of the budget stays where it belongs.'],
		['No incentive to push you anywhere', 'We don’t earn more if you take the bigger-salary role or the one that closes fastest. The only thing that matters to us is that the match is right, and we show you the reasons so you can check.'],
		['You stay anonymous', 'Employers see a summary of your experience and what you want. Never your name, contact details or salary floor, until you accept an intro. Your salary floor is only ever used for filtering.'],
		['You’re in control', 'See and edit everything we hold, see who asked to talk to you and why, pause when you’re happy where you are, and delete everything with one button.']
	];
</script>

<svelte:head><title>For candidates | {BRAND}</title></svelte:head>

<article class="max-w-[760px]">
	<p class="eyebrow">For candidates</p>
	<h1 class="mt-3 text-[40px] leading-[1.05] lg:text-[60px]">Free. Anonymous until you say yes. <em class="text-amber-ink">On your side.</em></h1>
	<p class="mt-5 max-w-[560px] text-[17px] leading-relaxed text-body text-pretty lg:text-lg">
		Ten minutes telling an agent what you actually want next, then only roles that fit, and companies who have to ask before they can see your name.
	</p>
	<a href="/chat" class="btn-amber mt-7">Start the chat →</a>

	<h2 class="mt-14 text-[30px] leading-[1.1] lg:text-[40px]">Why a flat-fee service is better for you</h2>
	<div class="ledger mt-5">
		{#each reasons as [title, body], i (title)}
			<div class="ledger-row lg:grid lg:grid-cols-[56px_1fr] lg:border-b lg:border-b-rule-2 lg:py-[18px]">
				<p class="ledger-num lg:text-[40px]">0{i + 1}</p>
				<div>
					<h3 class="mt-0.5 font-sans text-[17px] font-bold leading-snug tracking-normal">{title}</h3>
					<p class="mt-1.5 text-[15px] leading-normal text-body text-pretty">{body}</p>
				</div>
			</div>
		{/each}
	</div>

	<h2 class="mt-14 text-[30px] leading-[1.1] lg:text-[40px]">What happens</h2>
	<ol class="mt-5 space-y-3 text-[15px] leading-normal text-body">
		<li><strong class="text-ink">A short chat, not a form.</strong> Skills with evidence, what you want more of, what you'd avoid, where and how you want to work.</li>
		<li><strong class="text-ink">A weekly shortlist of public roles</strong> that fit you, from company career pages, so it's useful from week one.</li>
		<li><strong class="text-ink">Intro requests from companies on {BRAND}.</strong> You see the role, the salary band and why you matched. Accept, and you're introduced directly to the hiring team.</li>
	</ol>

	<a href="/chat" class="btn-amber mt-10">Start the chat →</a>
</article>
