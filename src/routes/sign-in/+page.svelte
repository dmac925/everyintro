<script lang="ts">
	import { SignIn } from 'svelte-clerk';
	import { BRAND } from '$lib/brand';

	let { data } = $props();
	const signUpUrl = $derived(`/sign-up${data.returnTo.includes('?') ? data.returnTo.slice(data.returnTo.indexOf('?')) : ''}`);
</script>

<svelte:head><title>Sign in | {BRAND}</title></svelte:head>

<div class="mx-auto max-w-[440px] space-y-5 py-4 lg:py-10">
	<h1 class="text-[40px] leading-[1.05]">{data.as === 'employer' ? 'Sign in to hire' : 'Sign in'}</h1>
	{#if data.claiming}
		<p class="flex items-center gap-2.5 rounded-btn bg-teal-soft px-4 py-3 text-sm font-medium text-teal"><span class="dot bg-teal"></span>Your chat so far will be saved to this account.</p>
	{/if}
	<SignIn forceRedirectUrl={data.returnTo} signUpForceRedirectUrl={data.returnTo} {signUpUrl} />
	{#if data.as === 'employer'}
		<p class="text-sm text-muted">Posting a role? <a href="/post" class="font-semibold text-ink underline">Start here</a> and verify your work email in one step.</p>
	{/if}
</div>
