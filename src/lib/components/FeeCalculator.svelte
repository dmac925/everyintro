<script lang="ts">
	import { untrack } from 'svelte';
	import { COMPETITORS } from '$lib/brand';
	import { HIRE_PRICE_PENCE, HIRE_REFUND_DAYS } from '$lib/config';

	// What one hire costs at a given salary: percentage fees vs our flat fee.
	let { initialSalary = 65_000, initialHires = 3 }: { initialSalary?: number; initialHires?: number } = $props();

	// Seeded once from props; the sliders own the values after mount.
	let salary = $state(untrack(() => initialSalary));
	let hires = $state(untrack(() => initialHires));

	const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
	const ourPrice = HIRE_PRICE_PENCE / 100;

	const ai = $derived((salary * COMPETITORS.aiRecruiter.feePct) / 100);
	const agency = $derived((salary * COMPETITORS.agency.feePct) / 100);
	const ours = $derived(hires * ourPrice);
	const aiTotal = $derived(ai * hires);
	const agencyTotal = $derived(agency * hires);
	const saving = $derived(aiTotal - ours);
</script>

<div class="panel space-y-5">
	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-1">
			<label for="calc-salary" class="flex justify-between text-sm font-medium">
				<span>Salary of the role</span><span class="tabular-nums">{gbp(salary)}</span>
			</label>
			<input id="calc-salary" type="range" min="25000" max="200000" step="1000" bind:value={salary} class="w-full accent-accent" />
		</div>
		<div class="space-y-1">
			<label for="calc-hires" class="flex justify-between text-sm font-medium">
				<span>Hires this year</span><span class="tabular-nums">{hires}</span>
			</label>
			<input id="calc-hires" type="range" min="1" max="30" step="1" bind:value={hires} class="w-full accent-accent" />
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="text-left">
				<tr>
					<th class="label py-2">Who</th>
					<th class="label py-2 pl-4 text-right">Per hire</th>
					<th class="label hidden py-2 pl-4 text-right sm:table-cell">{hires} {hires === 1 ? 'hire' : 'hires'}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-rule tabular-nums">
				<tr>
					<td class="py-2.5">{COMPETITORS.agency.name} <span class="text-muted">({COMPETITORS.agency.feePct}%)</span></td>
					<td class="py-2.5 pl-4 text-right">{gbp(agency)}</td>
					<td class="hidden py-2.5 pl-4 text-right sm:table-cell">{gbp(agencyTotal)}</td>
				</tr>
				<tr>
					<td class="py-2.5">{COMPETITORS.aiRecruiter.name} <span class="text-muted">({COMPETITORS.aiRecruiter.feePct}% of {COMPETITORS.aiRecruiter.basis})</span></td>
					<td class="py-2.5 pl-4 text-right">{gbp(ai)}</td>
					<td class="hidden py-2.5 pl-4 text-right sm:table-cell">{gbp(aiTotal)}</td>
				</tr>
				<tr class="font-semibold">
					<td class="py-2.5">EveryIntro <span class="font-normal text-muted">(flat £{ourPrice} per hire)</span></td>
					<td class="py-2.5 pl-4 text-right text-good">{gbp(ourPrice)}</td>
					<td class="hidden py-2.5 pl-4 text-right text-good sm:table-cell">{gbp(ours)}</td>
				</tr>
			</tbody>
		</table>
	</div>

	<p class="text-sm">
		<span class="font-semibold">Against other AI recruiters you keep {gbp(saving)}</span> over {hires} {hires === 1 ? 'hire' : 'hires'}, enough to pay the person more, or hire another.
	</p>
	<p class="text-xs text-muted">
		AI recruiter fee from a leading AI recruiter's public pricing page, checked {COMPETITORS.aiRecruiter.checked}. Agency figure is an illustration; contingency fees vary (typically 15–30%). EveryIntro is charged per hire only, refunded in full if the hire leaves within {HIRE_REFUND_DAYS} days. Posting roles and requesting intros is free.
	</p>
</div>
