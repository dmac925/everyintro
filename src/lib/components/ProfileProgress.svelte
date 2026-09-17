<script lang="ts">
	import { profileProgress, type CandidateProfile } from '$lib/schemas';

	// The profile being built beside the chat (design 3a/3b).
	//  - 'strip': one dark row for the band under the header on mobile; tap → sheet.
	//  - 'card':  the desktop column: serif heading, count, bar, note, row list.
	// The first unfinished row is the one the agent is asking about now.
	let {
		profile,
		complete = false,
		variant = 'card',
		signedIn = false
	}: { profile: CandidateProfile; complete?: boolean; variant?: 'card' | 'strip'; signedIn?: boolean } = $props();

	const progress = $derived(profileProgress(profile));
	const pct = $derived(Math.round((progress.done / progress.total) * 100));
	const askingKey = $derived(complete ? null : (progress.items.find((i) => !i.done)?.key ?? null));
	let open = $state(false);

	$effect(() => {
		if (!open) return;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = overflow);
	});
</script>

{#snippet list()}
	<div class="rounded-card overflow-hidden border-[1.5px] border-rule bg-surface">
		{#each progress.items as item, i (item.key)}
			{@const asking = item.key === askingKey}
			<div
				class="grid grid-cols-[22px_1fr_auto] items-center gap-3 px-4 py-[13px] lg:grid-cols-[18px_1fr_auto] lg:gap-2.5 lg:py-1.5 {i > 0 ? 'border-t border-sunk' : ''} {asking ? 'bg-amber-soft' : ''}"
			>
				{#if item.done}
					<span class="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-extrabold text-cream lg:size-4 lg:text-[9px]">✓</span>
				{:else if asking}
					<span class="size-5 rounded-full border-2 border-amber lg:size-4"></span>
				{:else}
					<span class="size-5 rounded-full border-[1.5px] border-hairline lg:size-4"></span>
				{/if}
				<div class="min-w-0">
					<p class="label lg:text-[10px] {asking ? 'text-amber-ink' : ''}">{item.label}{item.private ? ' · private' : ''}</p>
					<p class="truncate text-[15px] leading-snug lg:text-[13px] {item.done ? 'font-semibold text-ink' : asking ? 'font-medium text-muted' : 'font-medium text-faint'}">
						{item.done ? item.value : asking ? 'Asking now' : (item.value ?? 'Not yet')}
					</p>
				</div>
				{#if item.done && signedIn}
					<a href="/me/profile" class="text-[13px] font-semibold text-muted hover:text-ink lg:text-xs">Edit</a>
				{:else}
					<span></span>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet header()}
	<div class="flex items-baseline justify-between">
		<h2 class="leading-none tracking-[-0.015em] {variant === 'card' ? 'text-[26px]' : 'text-[30px]'}">{complete ? 'Profile ready' : 'Your profile'}</h2>
		<span class="text-sm font-bold text-amber-ink tabular-nums">{progress.done} of {progress.total}</span>
	</div>
	<div class="h-1 overflow-hidden rounded-sm bg-rule {variant === 'card' ? 'mt-2.5' : 'mt-3.5'}" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Profile completeness">
		<div class="h-full rounded-sm bg-amber transition-[width] duration-500" style="width:{pct}%"></div>
	</div>
{/snippet}

{#if variant === 'card'}
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="shrink-0">
			{@render header()}
			<p class="mt-2 text-xs leading-snug text-muted">Fills in as you talk. Employers see the plain rows; private rows only filter.</p>
		</div>
		<div class="mt-3 min-h-0 overflow-y-auto">{@render list()}</div>
		{#if complete}
			<a href="/me/profile" class="btn mt-3 w-full shrink-0">Review and edit my profile</a>
		{:else}
			<p class="mt-3 shrink-0 rounded-2xl border-[1.5px] border-dashed border-hairline px-4 py-2.5 text-xs leading-normal text-muted">
				Once {progress.total} of {progress.total} are in, we'll show roles that fit and say why each one matched.
			</p>
		{/if}
	</div>
{:else}
	<button
		type="button"
		class="flex w-full items-center gap-3 rounded-[14px] bg-ink-2 px-3 py-2.5 text-left text-cream"
		aria-expanded={open}
		aria-controls="profile-sheet"
		onclick={() => (open = true)}
	>
		<span class="min-w-0 flex-1">
			<span class="flex justify-between text-xs font-bold"><span>{complete ? 'Profile ready' : 'Your profile'}</span><span class="text-amber tabular-nums">{progress.done} of {progress.total}</span></span>
			<span class="mt-2 block h-1 overflow-hidden rounded-sm bg-ink-3"><span class="block h-full rounded-sm bg-amber transition-[width] duration-500" style="width:{pct}%"></span></span>
		</span>
		<span class="flex items-center gap-1 text-[13px] font-semibold text-on-dark">View <span aria-hidden="true">›</span></span>
	</button>

	<div inert={!open}>
		<button
			type="button"
			class="fixed inset-0 z-40 bg-ink/45 transition-opacity duration-200 {open ? 'opacity-100' : 'pointer-events-none opacity-0'}"
			aria-label="Close profile"
			tabindex="-1"
			onclick={() => (open = false)}
		></button>
		<div
			id="profile-sheet"
			class="fixed inset-x-0 bottom-0 z-50 max-h-[88svh] overflow-y-auto rounded-t-3xl bg-ground px-5 pt-2.5 pb-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,.5)] transition-transform duration-200 ease-out {open ? 'translate-y-0' : 'translate-y-full'}"
			role="dialog"
			aria-modal="true"
			aria-label="Your profile so far"
		>
			<div class="mx-auto mb-[18px] h-1 w-10 rounded-sm bg-hairline"></div>
			{@render header()}
			<p class="mt-2.5 text-[13px] leading-snug text-muted">Employers see the plain rows. Rows marked private are only used to filter.</p>
			<div class="mt-[18px]">{@render list()}</div>
			{#if complete}
				<a href="/me/profile" class="btn-amber mt-3.5 w-full">Review and edit my profile</a>
			{/if}
			<button type="button" class="btn mt-3.5 w-full" onclick={() => (open = false)}>Back to the chat</button>
		</div>
	</div>
{/if}
