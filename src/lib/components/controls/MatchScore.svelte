<script lang="ts">
	import { overlay } from '$lib/storage.svelte';
	import { BestOfs } from '$lib/types.svelte';
	import { bracketMatchBetween, deselectMatch } from '$lib/bracket-live.svelte';
	import {
		bestOfOf,
		gameWins,
		playersOf,
		roundNameOf,
		setBestOf,
		setGameWins,
		winnerOf,
		winsNeeded,
		type Slot
	} from '$lib/Bracket.svelte';
	import RadioInputs from './RadioInputs.svelte';

	// the selected players' bracket match as a scoreboard: player A's games won, the match's best
	// of, then player B's, mirrored like the match scene. Only shown when the two have a match on
	// the bracket picked in the controls

	const match = $derived(
		bracketMatchBetween(overlay.current.players[0], overlay.current.players[1])
	);
	// the bracket's slot for each side: player A may be the bracket's B
	const sides = $derived.by((): [Slot, Slot] | undefined => {
		if (!match) return undefined;
		const [A] = playersOf(match.bracket, match.id);
		return overlay.current.players[0] == A ? ['A', 'B'] : ['B', 'A'];
	});
</script>

{#if match && sides}
	{@const wins = gameWins(match.bracket, match.id)}
	{@const needed = winsNeeded(match.bracket, match.id)}
	{@const decided = !!winnerOf(match.bracket, match.id)}
	<div
		class="mb-3 flex flex-col items-center gap-1.5 rounded-sm bg-obs-padding/40 px-3 py-2"
		role="group"
		aria-label="match score"
	>
		<!-- the title centred, with deselect at the end of its row -->
		<div class="relative flex w-full justify-center">
			<span class="text-sm text-ctp-subtext0">
				{[roundNameOf(match.bracket, match.id), match.bracket.name].filter(Boolean).join(' · ')}
			</span>
			<button
				class="absolute top-0 right-0 button-link text-sm"
				title="stop showing this match's score and live status, until it's made live again or its next race starts"
				onclick={() => deselectMatch(match.bracket, match.id)}>deselect</button
			>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
			{@render Pips(sides[0], 'A', false)}
			<div class="flex items-center gap-2">
				<span class="label">best of</span>
				<RadioInputs
					opts={[...BestOfs]}
					bind:value={
						() => bestOfOf(match.bracket, match.id), (n) => setBestOf(match.bracket, match.id, n)
					}
				/>
			</div>
			{@render Pips(sides[1], 'B', true)}
		</div>
	</div>

	<!-- one box per game needed, filled from the outside in. Click a box to set the score to it,
         or the last filled box to take that game back -->
	{#snippet Pips(slot: Slot, label: string, mirrored: boolean)}
		<div class="flex gap-1.5 {mirrored ? 'flex-row-reverse' : ''}">
			{#each { length: needed }, i (i)}
				{@const filled = i < wins[slot]}
				{@const target = i + 1 == wins[slot] ? i : i + 1}
				<button
					class="size-6 rounded-sm border-2 transition-colors duration-150
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ctp-lavender
                        disabled:cursor-not-allowed disabled:opacity-40
                        {filled
						? 'border-ctp-lavender-950 bg-ctp-lavender hover:bg-ctp-lavender/80'
						: 'border-ctp-overlay0 hover:border-ctp-lavender'}"
					aria-label="player {label}: {target} of {needed} games won"
					aria-pressed={filled}
					disabled={decided && target > wins[slot]}
					onclick={() => setGameWins(match.bracket, match.id, slot, target)}
				></button>
			{/each}
		</div>
	{/snippet}
{/if}
