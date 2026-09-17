<script lang="ts">
	import type { RoleStatus } from '$lib/types';

	let { status }: { status: RoleStatus } = $props();

	const styles: Record<RoleStatus, { label: string; cls: string }> = {
		draft: { label: 'Draft', cls: 'bg-sunk text-muted' },
		awaiting_payment: { label: 'Awaiting payment', cls: 'bg-warn-soft text-warn' },
		open: { label: 'Open', cls: 'bg-good-soft text-good' },
		closed: { label: 'Closed', cls: 'bg-sunk text-muted' },
		expired: { label: 'Expired', cls: 'bg-sunk text-muted' }
	};
</script>

<span class="pill {styles[status].cls}">{styles[status].label}</span>
