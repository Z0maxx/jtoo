<script lang="ts">
	import type { SteamID3 } from '$lib/types.svelte';
	import { getPlayer } from '$lib/util';
	import { flip } from 'svelte/animate';

	type Props = {
		players: SteamID3[];
		onremove: Function;
		onchange?: Function;
		debug?: boolean;
		class?: string;
	};
	let { players = $bindable(), onchange, onremove, debug, class: styleClass }: Props = $props();

	let playerObjs = $derived(getPlayerObjs(players));

	function getPlayerObjs(players: SteamID3[]) {
		let list = [];
		for (const p of players) {
			list.push(getPlayer(p));
		}
		return list;
	}

	function removePlayer(player: SteamID3) {
		players = players.filter((p) => p != player);
	}

	// moves a player so they end up at index `to`
	function movePlayer(from: number, to: number) {
		if (debug) console.log(players);

		const next = [...players];
		const [player] = next.splice(from, 1);
		next.splice(to, 0, player);
		players = next;

		if (onchange) onchange();

		if (debug) {
			console.log(players);
			console.log('-------------------------');
		}
	}

	// MARK: Dragging
	// A gap is where a dropped player would go: gap 0 is above the first player, gap n below the last.

	let listEl: HTMLElement | undefined = $state();
	let dragged = $state(-1);
	let gap = $state(-1);
	let lineTop = $state(0);

	// dropping just above or below the player being dragged wouldn't move them
	let moves = $derived(dragged != -1 && gap != -1 && gap != dragged && gap != dragged + 1);

	// the gap nearest the pointer: over the bottom half of a player is below them, over the top
	// half is above them. The space between players counts too.
	function findGap(e: DragEvent) {
		if (dragged == -1 || !listEl) return;
		e.preventDefault();
		const rects = [...listEl.children]
			.filter((el) => el.tagName == 'LI')
			.map((el) => el.getBoundingClientRect());
		gap = rects.filter((r) => r.top + r.height / 2 < e.clientY).length;

		// the line sits in the middle of the space between two players
		const above = rects[gap - 1]?.bottom;
		const below = rects[gap]?.top;
		const y = above != undefined && below != undefined ? (above + below) / 2 : (above ?? below);
		lineTop = y - listEl.getBoundingClientRect().top;
	}

	function drop() {
		if (moves) movePlayer(dragged, gap > dragged ? gap - 1 : gap);
		dragged = gap = -1;
	}
</script>

<div class="bg-obs-background {styleClass}">
	<div class="mb-2 grid grid-cols-12 opacity-60">
		<div class="col-span-1 text-center">Seed</div>
	</div>
	<ul class="relative flex flex-col gap-2" bind:this={listEl} ondragover={findGap} ondrop={drop}>
		{#each players as player, i (player)}
			{@const playerObj = playerObjs[i]}
			<li
				class="grid cursor-grab grid-cols-12 items-center bg-obs-padding
					{dragged == i ? 'opacity-40' : ''}"
				draggable={true}
				ondragstart={() => (dragged = i)}
				ondragend={() => (dragged = gap = -1)}
				animate:flip={{ duration: 150 }}
			>
				<div class="col-span-1 text-center opacity-60">{i + 1}</div>
				<div class="col-span-2">
					<img
						src={playerObj.avatarURL}
						alt=""
						class="size-12 rounded-xl object-cover object-center"
						draggable="false"
					/>
				</div>
				<div class="col-span-5">{playerObj.name}</div>
				<div class="col-span-2">
					<button
						class="button-remove"
						onclick={() => {
							removePlayer(player);
							onremove();
						}}>remove</button
					>
				</div>
				<div class="col-span-2 flex flex-col">
					<button
						class="button {i == 0 ? 'pointer-events-none opacity-20' : ''}"
						onclick={() => {
							movePlayer(i, i - 1);
						}}>⏶</button
					>
					<button
						class="button {i == players.length - 1 ? 'pointer-events-none opacity-20' : ''}"
						onclick={() => {
							movePlayer(i, i + 1);
						}}>⏷</button
					>
				</div>
			</li>
		{/each}

		<!-- where the dragged player would go -->
		{#if moves}
			<div
				class="pointer-events-none absolute inset-x-0 z-1 h-0.5 -translate-y-1/2 rounded-full bg-ctp-lavender-400"
				style:top="{lineTop}px"
			></div>
		{/if}
	</ul>
</div>
