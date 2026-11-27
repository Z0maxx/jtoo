<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import DonationMessages from '$lib/components/fundraising/DonationMessages.svelte';
	import FundraisingPanel from '$lib/components/fundraising/FundraisingPanel.svelte';
	import MatchMapPicks from './MatchMapPicks.svelte';
	import MiniLeaderboard from './MiniLeaderboard.svelte';
	import { showsMiniLeaderboard } from './mini-leaderboard';
	import { slide } from 'svelte/transition';
	import { showsMapPicks } from '$lib/map-picks';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { cubicInOut } from 'svelte/easing';

	// the dual pov match scene's area under the povs: space for chat, the mini leaderboard, then
	// donation messages, the fundraising totals and the map picks
	// the fundraising side shows whenever an event is set
	let eventSet = $derived(!!fundraisingState.current.eventUrl);

	// time attack duels don't show the leaderboard, and nor does a cleared one, so the
	// fundraising side takes its space
	let live: ConsoleLive = getContext('consoleLive');
	let hideLeaderboard = $derived(!!live.currentRace && !showsMiniLeaderboard(live.currentRace));

	let ksnWs: KSNWebSocket = getContext('ksnWs');
	let mapPicksShown = $derived(showsMapPicks(ksnWs.messages.mapPicks?.session));

	// the donation cards take whatever height the panel and the picks leave, so there's no gap
	// between the rows. below about a full card's height (header, name and two lines of
	// message) they shrink to a name and amount
	const FULL_CARD_PX = 140;
	let donationsHeight = $state(0);
	let compactDonations = $derived(mapPicksShown && donationsHeight < FULL_CARD_PX);
</script>

<!-- the columns are spaced with margins, not a gap, so the leaderboard's space (its width and
     margin) can slide away to nothing as it hides -->
<div class="flex min-h-0 w-full flex-1 px-4 py-2">
	<!-- kept clear for a twitch chat browser source -->
	<div class="mr-6 w-100 shrink-0"></div>

	<!-- a fixed column, so the rest doesn't move when there's no race to show. it slides open and
	     shut, and the fundraising side (donations, totals, map picks) grows and shrinks with it -->
	{#if !hideLeaderboard}
		<div
			class="mr-6 flex w-130 shrink-0"
			transition:slide={{ axis: 'x', duration: 500, easing: cubicInOut }}
		>
			<!-- full width while the column narrows, so it's clipped rather than squashed -->
			<MiniLeaderboard class="w-130 shrink-0" />
		</div>
	{/if}

	<!-- the panel and the picks keep their own height, the donation cards filling the rest above
	     them. without a fundraising event the picks fill it instead -->
	<div class="flex min-w-0 flex-1 flex-col gap-3.5">
		{#if eventSet}
			<div class="flex min-h-0 flex-1 flex-col" bind:clientHeight={donationsHeight}>
				<DonationMessages
					compact={compactDonations}
					recentMessages={!mapPicksShown}
					class="min-h-0 flex-1"
				/>
			</div>
			<FundraisingPanel class="shrink-0" />
		{/if}
		<MatchMapPicks class={eventSet ? 'h-26 shrink-0' : 'min-h-26 flex-1'} />
	</div>
</div>
