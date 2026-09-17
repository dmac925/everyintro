<script lang="ts">
	import { BRAND, REPO_URL } from '$lib/brand';
</script>

<footer class="bg-ink text-cream">
	<div class="container-x flex flex-wrap items-end justify-between gap-x-10 gap-y-5 py-7 sm:py-10">
		<div>
			<p class="font-display text-xl sm:text-2xl">{BRAND}</p>
			<p class="mt-1.5 text-sm text-on-dark sm:text-[15px]">AI hiring, flat fee, no cut of anyone's salary.</p>
		</div>
		<nav class="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold sm:gap-x-7 sm:text-[15px]" aria-label="Footer">
			<a href="/mission" class="hover:text-amber">Mission</a>
			<a href="/pricing" class="hover:text-amber">Pricing</a>
			<a href="/privacy" class="hover:text-amber">Privacy</a>
			<a href={REPO_URL} class="hover:text-amber">Source (AGPL-3.0)</a>
		</nav>
	</div>
</footer>
