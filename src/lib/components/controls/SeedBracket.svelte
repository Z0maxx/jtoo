<script lang="ts">
	import PopOver from './PopOver.svelte';
	import _ from 'underscore';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { Bracket10, Bracket8, Bracket4, type AnyBracket } from '$lib/Bracket.svelte';
	import { type BracketSize, type SteamID3 } from '$lib/types.svelte';
	import DraggableMatchList from '../DraggableMatchList.svelte';

	type Error = { state: boolean; msg: string };

	let error = $state({
		notEnoughPlayers: {
			state: false,
			msg: 'error: incorrect number of players for bracket'
		} as Error
	});
	let popoverState: 'open' | 'closed' = $state('closed');

	function clear() {}

	type Props = {
		container?: boolean;
		size: BracketSize;
		players: SteamID3[];
		bracket: AnyBracket | undefined;
	};
	let { container = true, size, players, bracket = $bindable() }: Props = $props();

	function onopen() {
		if (bracket) {
			return;
		}

		console.log('onopen');
		console.log(bracket);

		if (size == 10) {
			// seeds 1-6 seed the quarter-finals like an 8 player bracket, except seeds 1 and 2
			// wait for the winners of the play-ins (8v9 and 7v10)
			const b = new Bracket10();
			b.Upper.PlayIn[0].A = players[7];
			b.Upper.PlayIn[0].B = players[8];
			b.Upper.PlayIn[1].A = players[6];
			b.Upper.PlayIn[1].B = players[9];
			b.Upper.QuarterFinals[0].A = players[0];
			b.Upper.QuarterFinals[1].A = players[1];
			b.Upper.QuarterFinals[2].A = players[2];
			b.Upper.QuarterFinals[2].B = players[5];
			b.Upper.QuarterFinals[3].A = players[3];
			b.Upper.QuarterFinals[3].B = players[4];
			bracket = b;
		} else {
			bracket = size == 4 ? new Bracket4() : new Bracket8();

			// fill starting matches of bracket with players
			for (let i = 0; i < bracket.Upper.QuarterFinals.length; i++) {
				bracket.Upper.QuarterFinals[i].A = players[i];
				bracket.Upper.QuarterFinals[i].B = players[players.length - 1 - i];
			}
		}
		console.log(bracket);
	}
</script>

<PopOver title="seed bracket" bind:state={popoverState} clearfn={clear} {onopen} {container}>
	<section class="grid grid-cols-12 gap-2">
		<!-- MARK: Bracket Display -->
		{#if bracket}
			<div class="col-span-full flex flex-col">
				<h2 class="text-3xl" style:filter={getFiltersStyle()}>Starting Matches</h2>
				<DraggableMatchList bind:bracket {size} />
			</div>

			<hr class="hr" />

			<button
				class="button col-span-6"
				onclick={() => {
					popoverState = 'closed';
				}}
			>
				save bracket
			</button>
		{/if}

		<div class="col-span-6 flex flex-col">
			{#each Object.values(error) as e, i (i)}
				{#if e.state}
					<div>{e.msg}</div>
				{/if}
			{/each}
		</div>
	</section>
</PopOver>
