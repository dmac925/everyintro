<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head><title>Questions | EveryIntro</title></svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="text-[36px] leading-[1.05] lg:text-[44px]">Questions from companies</h1>
		<p class="text-muted">A company that shortlisted you wants to know a bit more. Your answer goes on your anonymous card. Keep names and employers out of it, and decline anything you'd rather not answer, it won't count against you.</p>
	</div>
	{#if form?.message}<p class="text-sm text-warn" role="alert">{form.message}</p>{/if}

	{#each data.pending as q (q.id)}
		<article class="panel space-y-3 border-amber">
			<p class="label">{q.role_title ?? 'A role'} · {q.company_name}</p>
			<p class="text-[17px] leading-snug">{q.sent_text}</p>
			<form method="POST" action="?/answer" use:enhance class="space-y-2">
				<input type="hidden" name="questionId" value={q.id} />
				<label for="answer-{q.id}" class="sr-only">Your answer</label>
				<textarea id="answer-{q.id}" name="answer" rows="3" maxlength="1000" required class="field" placeholder="A sentence or two is plenty."></textarea>
				<div class="flex flex-wrap items-center gap-2">
					<button class="btn">Send answer</button>
					<button class="btn-ghost" formaction="?/decline" formnovalidate>Decline</button>
					<span class="text-xs text-muted">Asked {q.created_at.slice(0, 10)}</span>
				</div>
			</form>
		</article>
	{:else}
		<p class="panel text-muted">No questions waiting. When a company asks one, it appears here and we'll email you.</p>
	{/each}

	{#if data.past.length}
		<section class="space-y-3">
			<h2 class="text-[24px] leading-[1.15]">Answered</h2>
			{#each data.past as q (q.id)}
				<article class="panel space-y-1.5 text-sm">
					<p class="label">{q.role_title ?? 'A role'} · {q.company_name}</p>
					<p class="font-medium">{q.sent_text}</p>
					{#if q.status === 'answered'}<p class="text-body">{q.answer}</p>{:else}<p class="text-muted">Declined</p>{/if}
				</article>
			{/each}
		</section>
	{/if}
</div>
