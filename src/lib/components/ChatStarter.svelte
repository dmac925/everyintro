<script lang="ts">
	import { goto } from '$app/navigation';
	import { setPending } from '$lib/client/pending';

	// Homepage entry point: the white "Your agent" card that breaks out of the
	// dark hero. The first message (or CV / LinkedIn URL) is carried to /chat,
	// where the conversation actually runs.
	let { greeting, idPrefix = 'starter' }: { greeting: string; idPrefix?: string } = $props();

	let input = $state('');
	let linkedin = $state('');
	let showLinkedIn = $state(false);
	let leaving = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	async function start(action: Parameters<typeof setPending>[0]) {
		if (leaving) return;
		leaving = true;
		setPending(action);
		await goto('/chat');
	}
</script>

<section class="rounded-[20px] bg-surface p-4 pt-[18px] text-ink shadow-lift lg:rounded-3xl lg:p-7 lg:shadow-hero" aria-label="Start your chat">
	<div class="flex items-center gap-2.5">
		<span class="size-2.5 rounded-full bg-amber"></span>
		<span class="eyebrow">Your agent</span>
	</div>
	<p class="mt-3 text-[17px] leading-normal text-pretty lg:mt-3.5 lg:text-lg">{greeting}</p>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			const text = input.trim();
			if (text) start({ message: text });
		}}
		class="mt-4 space-y-2 lg:mt-5"
	>
		<label for="{idPrefix}-input" class="sr-only">Your message</label>
		<textarea
			id="{idPrefix}-input"
			bind:value={input}
			rows="3"
			class="field min-h-[90px] resize-none rounded-[14px] p-3.5 text-base leading-normal lg:min-h-[120px] lg:rounded-2xl lg:p-4"
			placeholder="e.g. I'm a product designer in Manchester, 6 years in, looking for something more hands-on…"
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					(e.currentTarget.form as HTMLFormElement).requestSubmit();
				}
			}}
			disabled={leaving}
		></textarea>
		<button class="btn-amber h-13 w-full rounded-[14px] text-base lg:h-[54px]" disabled={leaving || !input.trim()}>
			<span>{leaving ? 'Opening…' : 'Start the chat'}</span><span aria-hidden="true">→</span>
		</button>
	</form>

	<div class="mt-2 grid grid-cols-2 gap-2 lg:mt-2.5 lg:gap-2.5">
		<input
			bind:this={fileInput}
			id="{idPrefix}-cv"
			type="file"
			accept="application/pdf,.pdf,.txt,.md"
			class="sr-only"
			onchange={(e) => {
				const f = e.currentTarget.files?.[0];
				if (f) start({ file: f });
			}}
		/>
		<button type="button" class="btn-ghost h-[46px] rounded-[14px] text-sm lg:h-12" disabled={leaving} onclick={() => fileInput?.click()}>Upload CV (PDF)</button>
		<button type="button" class="btn-ghost h-[46px] rounded-[14px] text-sm lg:h-12" disabled={leaving} aria-expanded={showLinkedIn} onclick={() => (showLinkedIn = !showLinkedIn)}>Import LinkedIn</button>
	</div>
	{#if showLinkedIn}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				const url = linkedin.trim();
				if (url) start({ linkedin: url });
			}}
			class="mt-2 flex gap-2"
		>
			<label for="{idPrefix}-linkedin" class="sr-only">LinkedIn profile URL</label>
			<input id="{idPrefix}-linkedin" bind:value={linkedin} type="url" placeholder="linkedin.com/in/you" class="field flex-1 py-2.5" disabled={leaving} />
			<button class="btn btn-sm h-11" disabled={leaving || !linkedin.trim()}>Import</button>
		</form>
	{/if}
	<p class="mt-3 px-0.5 text-[13px] leading-snug text-muted lg:mt-3.5">No account needed to start. We'll ask for an email when you want to save.</p>
</section>
