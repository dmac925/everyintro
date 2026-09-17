<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { ClerkProvider } from 'svelte-clerk';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';

	let { data, children } = $props();

	// The chat page is a fixed-viewport app screen: no footer, and the page never
	// scrolls (the chat and the profile list scroll inside their own boxes).
	const onChat = $derived(page.url.pathname === '/chat');
	// svelte-clerk reads `initialState` (from buildClerkProps) but leaves it out of its prop types.
	const clerkProps = $derived({ initialState: data.initialState });
</script>

<ClerkProvider {...clerkProps}>
<div class="flex min-h-dvh flex-col {onChat ? 'h-svh' : ''}">
	<SiteHeader user={data.user} />
	<!-- Pages that need a full-bleed band (landing hero, chat strip) use .bleed with a matching negative top margin. -->
	<main class="container-x flex-1 {onChat ? 'flex min-h-0 flex-col pt-6 pb-0 sm:pt-10 lg:py-6' : 'py-6 sm:py-10'}">
		{@render children()}
	</main>
	{#if !onChat}
		<SiteFooter />
	{/if}
</div>
</ClerkProvider>
