<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { BRAND, REPO_URL } from '$lib/brand';
	import SignOutButton from './SignOutButton.svelte';
	import type { User } from '$lib/types';

	// Ink header (design 1c / 2a / 3a). On the chat page the nav gives way to
	// an "Anonymous to employers" note and a Save progress pill, which signs
	// the visitor in and claims their chat.
	let { user }: { user: User | null } = $props();

	const links = $derived.by(() => {
		if (user?.kind === 'candidate')
			return [
				{ href: '/chat', label: 'Chat' },
				{ href: '/me/profile', label: 'Profile' },
				{ href: '/me/intros', label: 'Intros' },
				{ href: '/me/jobs', label: 'Jobs' }
			];
		if (user?.kind === 'employer')
			return [
				{ href: '/company', label: 'Roles' },
				{ href: '/company/intros', label: 'Intros' },
				{ href: '/company/billing', label: 'Billing' }
			];
		if (user?.kind === 'admin') return [{ href: '/admin', label: 'Admin' }];
		return [
			{ href: '/', label: 'Find a role' },
			{ href: '/employers', label: 'For employers' },
			{ href: '/pricing', label: 'Pricing' },
			{ href: '/mission', label: 'Mission' }
		];
	});

	const active = (href: string) =>
		href === '/' || href === '/company' ? page.url.pathname === href : page.url.pathname.startsWith(href);
	const onChat = $derived(page.url.pathname === '/chat' && !user);

	let menuOpen = $state(false);
	afterNavigate(() => (menuOpen = false));
	$effect(() => {
		if (!menuOpen) return;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = overflow);
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

<header class="bg-ink text-cream">
	<div class="container-x flex items-center justify-between py-4 sm:py-5">
		<a href="/" class="font-display text-[22px] leading-none font-medium tracking-[-0.01em] sm:text-[26px]">{BRAND}</a>

		{#if onChat}
			<p class="hidden items-center gap-2.5 text-sm font-semibold text-on-dark md:flex"><span class="dot bg-teal"></span>Anonymous to employers</p>
		{:else}
			<nav class="hidden items-center gap-8 text-[15px] font-semibold md:flex" aria-label="Main">
				{#each links as link (link.href)}
					<a href={link.href} class={active(link.href) ? 'text-cream' : 'text-on-dark hover:text-cream'} aria-current={active(link.href) ? 'page' : undefined}>{link.label}</a>
				{/each}
			</nav>
		{/if}

		<div class="flex items-center gap-2">
			{#if user}
				<span class="hidden max-w-[200px] truncate text-sm text-on-dark lg:inline">{user.email}</span>
				<SignOutButton class="pill-dark h-[38px] sm:h-10" />
			{:else if onChat}
				<a href="/sign-in?next=%2Fchat&as=candidate" class="pill-dark h-[34px] sm:h-10">Save progress</a>
			{:else}
				<a href="/sign-in" class="pill-dark h-[38px] sm:h-10">Sign in</a>
				<a href="/chat" class="pill-amber hidden sm:inline-flex">Start a chat</a>
			{/if}
			<button
				type="button"
				class="-mr-2 flex h-[38px] w-10 flex-col items-center justify-center gap-[5px] md:hidden"
				aria-label="Open menu"
				aria-expanded={menuOpen}
				aria-controls="mobile-menu"
				onclick={() => (menuOpen = true)}
			>
				<span class="h-0.5 w-5 bg-cream"></span><span class="h-0.5 w-5 bg-cream"></span>
			</button>
		</div>
	</div>
</header>

<!-- Drawer (design 1c): full-screen ink, with the menu on a cream card. -->
<div class="md:hidden" inert={!menuOpen}>
	<div
		id="mobile-menu"
		class="fixed inset-0 z-50 flex flex-col bg-ink text-cream transition-opacity duration-200 {menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}"
		role="dialog"
		aria-modal="true"
		aria-label="Menu"
	>
		<div class="flex items-center justify-between px-5 py-4">
			<a href="/" class="font-display text-[22px] leading-none font-medium">{BRAND}</a>
			<button type="button" class="-mr-2 flex h-[38px] w-10 items-center justify-end text-[26px] font-light leading-none" aria-label="Close menu" onclick={() => (menuOpen = false)}>×</button>
		</div>
		<div class="mx-4 mb-4 flex flex-1 flex-col rounded-[20px] bg-ground px-5 pt-6 pb-5 text-ink">
			<p class="eyebrow">Menu</p>
			<nav class="mt-2.5 flex flex-col" aria-label="Main">
				{#each links as link (link.href)}
					<a href={link.href} class="border-b border-rule-2 py-3.5 font-display text-[30px] leading-none {active(link.href) ? 'text-amber-ink' : ''}" aria-current={active(link.href) ? 'page' : undefined}>{link.label}</a>
				{/each}
			</nav>
			<div class="mt-4 flex gap-4 text-[13px] font-semibold text-muted">
				<a href="/privacy">Privacy</a>
				<a href={REPO_URL}>Source (AGPL-3.0)</a>
			</div>
			<div class="mt-auto grid grid-cols-2 gap-2 pt-6">
				{#if user}
					<p class="col-span-2 truncate text-sm text-muted">{user.email}</p>
					<SignOutButton class="btn-outline col-span-2 w-full" />
				{:else}
					<a href="/sign-in" class="btn-outline">Sign in</a>
					<a href="/chat" class="btn-amber">Start a chat</a>
				{/if}
			</div>
		</div>
	</div>
</div>
