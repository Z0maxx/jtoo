<script lang="ts">
	import type { AnyBracket, Match } from '$lib/Bracket.svelte';
	import type { BracketSize, Player, SteamID3 } from '$lib/types.svelte';
	import { getPlayer } from '$lib/util';

	let itemAIndex = $state(-1);
	let itemBIndex = $state(-1);

	type Props = {
		bracket: AnyBracket;
		size: BracketSize;
		onchange?: Function;
		debug?: boolean;
		class?: string;
	};
	let {
		bracket = $bindable(),
		size,
		onchange,
		debug,
		class: styleClass
	}: Props = $props();

	// a starting position for a player. `gap` ends a match in the list,
	// and `note` names an opponent that isn't seeded yet
	type Slot = { round: string; match: number; actor: 'A' | 'B'; gap?: boolean; note?: string };

	let slots: Slot[] = $derived(getStartingSlots(bracket, size));
	let players: SteamID3[] = $derived(slots.map((s) => getSlotMatch(s)[s.actor]!));

	function getStartingSlots(bracket: AnyBracket, maxPlayers: BracketSize): Slot[] {
		if (bracket.type == 10) {
			// top to bottom, as the bracket is drawn
			return [
				{ round: 'PlayIn', match: 0, actor: 'A' },
				{ round: 'PlayIn', match: 0, actor: 'B', gap: true },
				{ round: 'QuarterFinals', match: 0, actor: 'A', gap: true, note: 'vs play-in 1 winner' },
				{ round: 'QuarterFinals', match: 1, actor: 'A' },
				{ round: 'QuarterFinals', match: 1, actor: 'B', gap: true },
				{ round: 'PlayIn', match: 1, actor: 'A' },
				{ round: 'PlayIn', match: 1, actor: 'B', gap: true },
				{ round: 'QuarterFinals', match: 2, actor: 'A', gap: true, note: 'vs play-in 2 winner' },
				{ round: 'QuarterFinals', match: 3, actor: 'A' },
				{ round: 'QuarterFinals', match: 3, actor: 'B', gap: true }
			];
		}

		let list: Slot[] = [];
		for (let i = 0; i < maxPlayers / 2; i++) {
			list.push({ round: 'QuarterFinals', match: i, actor: 'A' });
			list.push({ round: 'QuarterFinals', match: i, actor: 'B', gap: true });
		}
		return list;
	}

	function getSlotMatch(slot: Slot): Match {
		return (bracket.Upper as Record<string, Match[]>)[slot.round][slot.match];
	}

	function syncBracket(players: SteamID3[]) {
		for (let i = 0; i < slots.length; i++) {
			getSlotMatch(slots[i])[slots[i].actor] = players[i];
		}
	}

	let playerObjs = $derived(getPlayerObjs(players));

	function getPlayerObjs(players: SteamID3[]) {
		let list = [];
		for (const p of players) {
			list.push(getPlayer(p));
		}
		return list;
	}

	function swapPlayers(aIndex: number, bIndex: number) {
		if (debug) console.log(players);

		let temp = players[aIndex];

		// remove dragged item
		players.splice(aIndex, 1);

		// place dragged item in location of dragover
		players.splice(bIndex, 0, temp);

		syncBracket(players);

		if (onchange) onchange();

		players = [...players];

		if (debug) {
			console.log(players);
			console.log('-------------------------');
		}
	}
</script>

<div class="bg-obs-background {styleClass}">
	<ul class="flex flex-col">
		{#each players as player, i (i)}
			{@const playerObj = playerObjs[i]}
			<li
				class="grid grid-cols-12 bg-obs-padding {slots[i].gap ? 'mb-2' : ''}"
				draggable={true}
				ondragstart={() => {
					itemAIndex = i;
				}}
				ondragenter={() => {
					itemBIndex = i;
				}}
				ondragend={() => (itemAIndex = -1)}
				ondragover={(e) => e.preventDefault()}
				ondrop={() => {
					swapPlayers(itemAIndex, itemBIndex);
				}}
			>
				<div class="col-span-2">
					<img
						src={playerObj.avatarURL}
						alt=""
						class="size-12 rounded-xl object-cover object-center"
						draggable="false"
					/>
				</div>
				<div class="col-span-8">
					{playerObj.name}
					{#if slots[i].note}
						<span class="opacity-60">({slots[i].note})</span>
					{/if}
				</div>
				<div class="col-span-2 flex flex-col">
					<button
						class="button {i == 0 ? 'pointer-events-none opacity-20' : ''}"
						onclick={() => {
							swapPlayers(i, i - 1);
						}}>⏶</button
					>
					<button
						class="button {i == players.length - 1 ? 'pointer-events-none opacity-20' : ''}"
						onclick={() => {
							swapPlayers(i, i + 1);
						}}>⏷</button
					>
				</div>
			</li>
		{/each}
	</ul>
</div>
