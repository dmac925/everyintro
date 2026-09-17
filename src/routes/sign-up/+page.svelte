<script lang="ts">
	import { SignUp } from 'svelte-clerk';
	import { BRAND } from '$lib/brand';

	let { data } = $props();
</script>

<svelte:head><title>Create an account | {BRAND}</title></svelte:head>

<div class="mx-auto max-w-[440px] space-y-5 py-4 lg:py-10">
	<h1 class="text-[40px] leading-[1.05]">{data.as === 'employer' ? 'Create a hiring account' : 'Create an account'}</h1>
	<SignUp forceRedirectUrl={data.returnTo} signInForceRedirectUrl={data.returnTo} signInUrl={data.returnTo} />
</div>
