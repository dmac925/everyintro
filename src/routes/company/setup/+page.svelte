<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<svelte:head><title>Set up your company | EveryIntro</title></svelte:head>

<div class="mx-auto max-w-lg space-y-6">
	<div>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Set up your company</h1>
		<p class="text-muted">EveryIntro is for direct employers. Your company is tied to your work email domain.</p>
	</div>

	{#if data.freeMail}
		<p class="rounded-md bg-warn-soft px-4 py-3 text-sm text-warn">
			You signed in with a personal address ({data.domain}). Sign out and use your work email.
		</p>
	{/if}

	<form method="POST" use:enhance class="panel space-y-4">
		<div class="space-y-1">
			<label for="name" class="text-sm font-medium">Company name</label>
			<input id="name" name="name" required class="field" />
		</div>
		<div class="space-y-1">
			<p class="text-sm font-medium">Email domain</p>
			<p class="font-mono text-sm">{data.domain}</p>
		</div>
		<div class="space-y-1">
			<label for="companies_house_no" class="text-sm font-medium">Companies House number</label>
			<input id="companies_house_no" name="companies_house_no" class="field" placeholder="01234567" />
			<p class="text-xs text-muted">Used to verify you're a UK employer, not an agency.</p>
		</div>
		{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}
		<button class="btn" disabled={data.freeMail}>Create company</button>
	</form>
</div>
