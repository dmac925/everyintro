<script lang="ts">
	import { enhance } from '$app/forms';
	import ProfileCard from '$lib/components/ProfileCard.svelte';

	let { data, form } = $props();
	let editing = $state(false);
	const p = $derived(data.profile);
</script>

<svelte:head><title>Your profile | EveryIntro</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Your profile</h1>
			<p class="text-muted">Status: <span class="font-semibold capitalize">{data.status}</span></p>
		</div>
		<div class="flex gap-2">
			<button class="btn-ghost" onclick={() => (editing = !editing)}>{editing ? 'Cancel' : 'Edit'}</button>
			<a href="/chat" class="btn-ghost">Back to chat</a>
		</div>
	</div>

	{#if form?.saved}<p class="text-sm text-good" role="status">Saved.</p>{/if}
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

	{#if editing}
		<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { await update({ reset: false }); editing = false; }} class="panel grid gap-4 sm:grid-cols-2">
			<div class="space-y-1 sm:col-span-2">
				<label for="target_titles" class="text-sm font-medium">Job titles (comma-separated)</label>
				<input id="target_titles" name="target_titles" class="field" value={p.target_titles.join(', ')} />
			</div>
			<div class="space-y-1">
				<label for="salary_floor_gbp" class="text-sm font-medium">Lowest salary you'd move for (£, private)</label>
				<input id="salary_floor_gbp" name="salary_floor_gbp" inputmode="numeric" class="field" value={p.salary_floor_gbp ?? ''} />
			</div>
			<div class="space-y-1">
				<label for="location" class="text-sm font-medium">Location</label>
				<input id="location" name="location" class="field" value={p.location ?? ''} />
			</div>
			<div class="space-y-1">
				<label for="work_mode" class="text-sm font-medium">Work mode</label>
				<select id="work_mode" name="work_mode" class="field" value={p.work_mode ?? ''}>
					<option value="">Choose</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="any">Any</option>
				</select>
			</div>
			<div class="space-y-1">
				<label for="notice_weeks" class="text-sm font-medium">Notice (weeks)</label>
				<input id="notice_weeks" name="notice_weeks" inputmode="numeric" class="field" value={p.notice_weeks ?? ''} />
			</div>
			<div class="space-y-1">
				<label for="right_to_work_uk" class="text-sm font-medium">UK right to work</label>
				<select id="right_to_work_uk" name="right_to_work_uk" class="field" value={p.right_to_work_uk == null ? '' : p.right_to_work_uk ? 'yes' : 'no'}>
					<option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>
				</select>
			</div>
			<div class="space-y-1 sm:col-span-2">
				<label for="wants" class="text-sm font-medium">What you want (one per line)</label>
				<textarea id="wants" name="wants" rows="3" class="field">{p.wants.join('\n')}</textarea>
			</div>
			<div class="space-y-1 sm:col-span-2">
				<label for="dealbreakers" class="text-sm font-medium">Dealbreakers (one per line)</label>
				<textarea id="dealbreakers" name="dealbreakers" rows="3" class="field">{p.dealbreakers.join('\n')}</textarea>
			</div>
			<!-- TODO(profile): skills editor (skill + evidence pairs). -->
			<div class="sm:col-span-2"><button class="btn">Save changes</button></div>
		</form>
	{:else}
		<ProfileCard profile={p} />
	{/if}

	<section class="panel space-y-2">
		<p class="label">What employers see</p>
		<p class="text-sm">{data.blindSummary ?? 'Finish the chat to generate your anonymous summary.'}</p>
		<p class="text-xs text-muted">Plus the facts above except your salary floor. Never your name or contact details until you accept an intro.</p>
	</section>

	<section class="flex flex-wrap gap-3">
		{#if data.status === 'paused'}
			<form method="POST" action="?/resume" use:enhance><button class="btn-ghost">Resume profile</button></form>
		{:else}
			<form method="POST" action="?/pause" use:enhance><button class="btn-ghost">Pause profile</button></form>
		{/if}
		<form
			method="POST"
			action="?/delete"
			onsubmit={(e) => {
				if (!confirm('Delete your account and all your data? This cannot be undone.')) e.preventDefault();
			}}
		>
			<button class="btn-ghost border-warn text-warn">Delete account and data</button>
		</form>
	</section>
</div>
