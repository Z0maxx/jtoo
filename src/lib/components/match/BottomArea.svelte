<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import DonationMessages from '$lib/components/fundraising/DonationMessages.svelte';
	import FundraisingPanel from '$lib/components/fundraising/FundraisingPanel.svelte';
	import MatchMapPicks from './MatchMapPicks.svelte';
	import MiniLeaderboard from './MiniLeaderboard.svelte';
	import { showsMiniLeaderboard } from './mini-leaderboard';

	// the dual pov match scene's area under the povs: space for chat, the mini leaderboard, then
	// donation messages, the fundraising totals and the map picks
	// the fundraising side shows whenever an event is set
	let eventSet = $derived(!!fundraisingState.current.eventUrl);

	// time attack duels don't show the leaderboard, and nor does a cleared one, so the
	// fundraising side takes its space
	let live: ConsoleLive = getContext('consoleLive');
	let hideLeaderboard = $derived(!!live.currentRace && !showsMiniLeaderboard(live.currentRace));
</script>

<div class="flex min-h-0 w-full flex-1 gap-6 px-4 py-2">
	<!-- kept clear for a twitch chat browser source -->
	<div class="w-100 shrink-0"></div>

	<!-- a fixed column, so the rest doesn't move when there's no race to show -->
	{#if !hideLeaderboard}
		<div class="flex w-130 shrink-0">
			<MiniLeaderboard class="flex-1" />
		</div>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col gap-3.5">
		{#if eventSet}
			<DonationMessages class="min-h-0 flex-1" />
			<!-- the panel keeps its full height and the donation cards take what's left -->
			<FundraisingPanel class="shrink-0" />
		{/if}
		<MatchMapPicks class="mt-auto h-26 shrink-0" />
	</div>
</div>
