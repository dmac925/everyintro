<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Home | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Welcome back</h1>

	{#if data.candidateStatus === 'onboarding'}
		<div class="panel space-y-3 border-accent bg-accent-soft">
			<p class="font-semibold">Start with a short chat</p>
			<p class="text-sm text-muted">About 10 minutes on what you want next. It builds your profile, and you can edit it after.</p>
			<a href="/chat" class="btn">Start the chat</a>
		</div>
	{:else if data.candidateStatus === 'paused'}
		<div class="panel space-y-2 bg-warn-soft">
			<p class="font-semibold">Your profile is paused</p>
			<p class="text-sm text-muted">Employers can't see you and you won't get a digest. Resume it from your profile.</p>
			<a href="/me/profile" class="btn-ghost">Go to profile</a>
		</div>
	{/if}

	<div class="grid gap-4 sm:grid-cols-3">
		<a href="/me/intros" class="panel block hover:border-accent">
			<p class="label">Intro requests</p>
			<p class="mt-1 font-display text-[36px] leading-none">{data.pendingIntros}</p>
			<p class="text-sm text-muted">waiting for your answer</p>
		</a>
		<a href="/me/jobs" class="panel block hover:border-accent">
			<p class="label">Matched public roles</p>
			<p class="mt-1 font-display text-[36px] leading-none">{data.digestCount}</p>
			<p class="text-sm text-muted">from your weekly digests</p>
		</a>
		<a href="/me/profile" class="panel block hover:border-accent">
			<p class="label">Profile</p>
			<p class="mt-1 font-display text-[36px] leading-none capitalize">{data.candidateStatus}</p>
			<p class="text-sm text-muted">view, edit or pause</p>
		</a>
	</div>
</div>
