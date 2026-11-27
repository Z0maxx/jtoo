<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { DonationMilestone, DonationsOverview } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';
	import RocketProgressBar from './RocketProgressBar.svelte';

	// the fundraising totals, rocket bar and next milestone, for the match scene's bottom area
	type Props = { class?: string };
	let { class: styleClass = '' }: Props = $props();

	let overview: DonationsOverview = $state({ goal: 0, raised: 0, donationCount: 0 });
	let milestones: DonationMilestone[] = $state([]);

	const overviewSubId = Dwb.subscribeToDonationsOverview((o) => (overview = o));
	const milestonesSubId = Dwb.subscribeToMilestones((m) => (milestones = m));
	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
		Dwb.unsubscribeFromMilestones(milestonesSubId);
	});

	const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
	// the rocket bar moves the goal on by 1000 each time it fills
	let goal = $derived(fundraisingState.current.sumGoal || overview.goal);
	// dwb's isActive only says a milestone is enabled, so the next one is the first not reached
	// yet: marked complete by dwb, or passed by the total before dwb catches up
	let next = $derived(milestones.find((m) => !m.isComplete && m.goal > overview.raised));
</script>

<div class="{styleClass} relative isolate flex flex-col gap-2.5 px-4.5 py-3.5">
	<!-- background -->
	<div
		class="absolute inset-0 -z-1 rounded-[10px] bg-[#0f0f16]/92 ring-1 ring-ctp-lavender/20 ring-inset"
		style:filter={getFiltersStyle()}
	></div>
	<div class="flex items-baseline gap-2.5">
		<span class="text-3xl font-bold text-ctp-lavender" style:filter={getFiltersStyle()}
			>{money(overview.raised)}</span
		>
		<span class="text-lg text-ctp-subtext0" style:filter={getFiltersStyle()}>
			raised of {money(goal)} goal · {overview.donationCount} donations
		</span>
		{#if settings.current.enableFundraisingRtd}
			<span class="ml-auto text-base text-ctp-overlay2" style:filter={getFiltersStyle()}
				>$20+ rolls RTD · !rtd in chat</span
			>
		{/if}
	</div>
	<RocketProgressBar {overview} />
	{#if next}
		<!-- milestone descriptions run long, so they get two lines instead of being cut off -->
		<span
			class="line-clamp-2 text-base leading-snug text-ctp-subtext0"
			style:filter={getFiltersStyle()}
		>
			next milestone
			<span class="text-ctp-lavender {settings.current.monoFont}">{money(next.goal)}</span>
			· {next.description}
		</span>
	{/if}
</div>
