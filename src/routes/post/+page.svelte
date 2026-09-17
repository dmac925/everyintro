<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { useClerkContext } from 'svelte-clerk';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import RoleSpecCard from '$lib/components/RoleSpecCard.svelte';
	import { BRAND } from '$lib/brand';
	import { ROLE_GREETING } from '$lib/copy';
	import { HIRE_PRICE_PENCE } from '$lib/config';
	import { isFreeMail } from '$lib/freeMail';
	import { setPending, takePending } from '$lib/client/pending';
	import type { RoleSpec } from '$lib/schemas';

	let { data } = $props();

	// Clerk's email-code flow, driven by hand so the page keeps its own look:
	// sign up if the address is new, otherwise sign in. No passwords anywhere.
	const ctx = useClerkContext();
	let email = $state('');
	let code = $state('');
	let sent = $state(false);
	let busy = $state(false);
	let message = $state<string | null>(null);
	let mode: 'signUp' | 'signIn' = 'signUp';

	// What they type while waiting for the code; sent as the first message once verified.
	let draft = $state('');
	let spec = $state<RoleSpec | null>(untrack(() => (data.stage === 'chat' ? data.spec : null)));
	let complete = $state(untrack(() => data.stage === 'chat' && data.complete));

	function clerkMessage(err: unknown): string {
		const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
		return e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? 'Something went wrong. Try again.';
	}
	const clerkCode = (err: unknown) => (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;

	async function sendCode(e: SubmitEvent) {
		e.preventDefault();
		message = null;
		const address = email.trim().toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return (message = 'Enter a valid email address.');
		if (isFreeMail(address)) return (message = 'Use your work email. EveryIntro is for direct employers, not agencies.');
		const clerk = ctx.clerk;
		if (!clerk?.client) return (message = 'Sign-in is still loading. Try again in a moment.');
		busy = true;
		try {
			try {
				const signUp = await clerk.client.signUp.create({ emailAddress: address });
				await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
				mode = 'signUp';
			} catch (err) {
				if (clerkCode(err) !== 'form_identifier_exists') throw err;
				// Known address: sign in with a code instead.
				const signIn = await clerk.client.signIn.create({ identifier: address });
				const factor = signIn.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
				if (!factor || factor.strategy !== 'email_code') throw new Error('Email codes aren’t enabled for sign-in.');
				await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
				mode = 'signIn';
			}
			email = address;
			sent = true;
		} catch (err) {
			message = clerkMessage(err);
		} finally {
			busy = false;
		}
	}

	async function confirm(e: SubmitEvent) {
		e.preventDefault();
		message = null;
		const clerk = ctx.clerk;
		if (!clerk?.client) return;
		busy = true;
		try {
			const digits = code.replace(/\D/g, '');
			const result =
				mode === 'signUp'
					? await clerk.client.signUp.attemptEmailAddressVerification({ code: digits })
					: await clerk.client.signIn.attemptFirstFactor({ strategy: 'email_code', code: digits });
			if (result.status !== 'complete' || !result.createdSessionId) {
				message = 'That code didn’t match, or it has expired. Check the email or send a new one.';
				return;
			}
			await clerk.setActive({ session: result.createdSessionId });
			const text = draft.trim();
			if (text) setPending({ message: text });
			await invalidateAll(); // the load registers the employer and switches to the chat
		} catch (err) {
			message = clerkMessage(err);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Post a role | {BRAND}</title></svelte:head>

<div class="mx-auto max-w-[1040px] space-y-5 lg:space-y-6">
	<header>
		<p class="eyebrow">For employers</p>
		<h1 class="mt-2 text-[36px] leading-[1.05] lg:text-[48px]">Post a role</h1>
		<p class="mt-2 max-w-[600px] text-[15px] leading-normal text-muted text-pretty lg:text-base">
			Verify your work email, then describe the role or paste the job description. Under five minutes. Free until you hire, then a flat £{HIRE_PRICE_PENCE / 100}.
		</p>
	</header>

	{#if data.stage === 'chat'}
		{@const pending = takePending()}
		<p class="panel flex flex-wrap items-center justify-between gap-3 text-sm">
			<span class="flex items-center gap-2.5 font-medium"><span class="dot bg-teal"></span>{data.email} verified</span>
			<a href="/company" class="font-semibold text-muted hover:text-ink">Your roles</a>
		</p>
		<div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
			<ChatPanel
				getEndpoint={async () => `/api/intake/${data.conversationId}`}
				greeting={ROLE_GREETING}
				initial={data.lines}
				{complete}
				{pending}
				autofocus={!pending}
				ondraft={(d) => (spec = d as RoleSpec)}
				oncomplete={() => (complete = true)}
			/>
			<div class="space-y-3">
				{#if complete}
					<div class="panel space-y-2 border-good bg-good-soft">
						<p class="font-semibold text-good">Spec ready</p>
						<a href="/company/roles/{data.roleId}" class="btn">Review and open the role</a>
					</div>
				{/if}
				{#if spec}<RoleSpecCard {spec} />{/if}
			</div>
		</div>
	{:else if data.stage === 'candidate'}
		<div class="panel space-y-3 text-sm">
			<p>You're signed in as a candidate ({data.email}). Sign out and use your work email to post a role.</p>
			<form method="POST" action="/sign-out"><button class="btn">Sign out</button></form>
		</div>
	{:else if data.stage === 'blocked'}
		<div class="panel space-y-3 text-sm">
			<p class="text-warn" role="alert">{data.message}</p>
			<form method="POST" action="/sign-out"><button class="btn">Sign out</button></form>
		</div>
	{:else}
		<!-- Step 1: email → code, through Clerk. -->
		<form onsubmit={sendCode} class="panel space-y-3">
			<label for="email" class="label">Your work email</label>
			<div class="flex flex-col gap-2 sm:flex-row">
				<input id="email" name="email" type="email" required autocomplete="email" placeholder="you@company.co.uk" class="field-white flex-1" bind:value={email} readonly={sent} />
				<button class="{sent ? 'btn-ghost' : 'btn'} h-[46px] shrink-0" disabled={busy || !ctx.isLoaded}>{sent ? 'Send a new code' : 'Verify email'}</button>
			</div>
			<!-- Clerk mounts its bot check here during sign-up (required for custom flows). -->
			<div id="clerk-captcha"></div>
			{#if message && !sent}<p class="text-sm text-warn" role="alert">{message}</p>{/if}
		</form>

		{#if sent}
			<form onsubmit={confirm} class="panel space-y-3 border-amber">
				<label for="code" class="label">Code from your email</label>
				<p class="text-sm text-body">We sent a six-digit code to <span class="font-semibold">{email}</span>.</p>
				<div class="flex flex-col gap-2 sm:flex-row">
					<!-- svelte-ignore a11y_autofocus -->
					<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="123456" class="field-white flex-1 tracking-[0.3em] tabular-nums sm:max-w-[220px]" bind:value={code} autofocus />
					<button class="btn-amber h-[46px] shrink-0" disabled={busy}>Confirm and start</button>
				</div>
				{#if message}<p class="text-sm text-warn" role="alert">{message}</p>{/if}
			</form>
		{/if}

		<!-- Step 2 preview: they can write while the code arrives; it becomes the first message. -->
		<section class="rounded-3xl border-[1.5px] border-rule bg-surface p-5 lg:p-7" aria-label="Describe the role">
			<div class="flex gap-3">
				<span class="mt-[9px] size-2 shrink-0 rounded-full bg-amber"></span>
				<p class="text-[15px] leading-normal text-body lg:text-base">{ROLE_GREETING}</p>
			</div>
			<label for="draft" class="sr-only">Describe the role or paste the job description</label>
			<textarea id="draft" bind:value={draft} rows="7" class="field mt-4 resize-y" placeholder="e.g. Senior product designer, London hybrid, £75k to £90k, owning the onboarding flow. Or paste the whole job description."></textarea>
			<p class="mt-2 text-xs text-muted">{sent ? 'Confirm the code above and this goes straight to the agent.' : 'Verify your email above and this goes straight to the agent.'}</p>
		</section>
	{/if}
</div>
