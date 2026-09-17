<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	// Clerk's client-side sign-out, styled like any of our buttons.
	let { class: cls = '', label = 'Sign out' }: { class?: string; label?: string } = $props();
	const ctx = useClerkContext();
	let busy = $state(false);

	async function signOut() {
		busy = true;
		try {
			if (ctx.clerk) await ctx.clerk.signOut({ redirectUrl: '/' });
			else window.location.href = '/';
		} finally {
			busy = false;
		}
	}
</script>

<button type="button" class={cls} disabled={busy} onclick={signOut}>{label}</button>
