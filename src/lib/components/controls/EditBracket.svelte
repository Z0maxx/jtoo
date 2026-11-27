<script lang="ts">
	import PopOver from './PopOver.svelte';
	import RadioInputs from './RadioInputs.svelte';
	import DraggablePlayerList from '../DraggablePlayerList.svelte';
	import StartingMatches from '../StartingMatches.svelte';
	import { items } from '$lib/storage.svelte';
	import {
		BracketSizes,
		Eliminations,
		newBracket,
		type SavedBracket,
		type SteamID3
	} from '$lib/types.svelte';
	import { getPlayer } from '$lib/util';
	import { poolPlayers } from '$lib/console-pools.svelte';

	// Creates a bracket, or edits one when given, from JTOO's pool of players.
	type Props = { bracket?: SavedBracket };
	let { bracket: initial }: Props = $props();

	let mode: 'add' | 'edit' = $derived(initial ? 'edit' : 'add');
	// a working copy, taken fresh each time the popover opens
	let bracket: SavedBracket = $state(newBracket());

	let popoverState: 'open' | 'closed' = $state('closed');
	let search = $state('');
	let error = $state('');

	let results = $derived(
		search.trim()
			? poolPlayers()
					.filter((id) => !bracket.players.includes(id))
					.map((id) => getPlayer(id))
					.filter((p) => p.name?.toLowerCase().includes(search.trim().toLowerCase()))
					.slice(0, 12)
			: poolPlayers()
					.filter((id) => !bracket.players.includes(id))
					.map((id) => getPlayer(id))
	);

	// the players' order is the seeding, so any change to it starts the results over
	function setPlayers(players: SteamID3[]) {
		bracket = { ...bracket, players, results: {}, games: {}, bestOfs: {} };
		error = '';
	}

	// matches' own best ofs go too, as a new format or seeding can mean different matches
	function clearResults() {
		bracket.results = {};
		bracket.games = {};
		bracket.bestOfs = {};
	}

	function addPlayer(id: SteamID3) {
		if (bracket.players.length >= bracket.size) {
			error = `a ${bracket.size} player bracket is full`;
			return;
		}
		setPlayers([...bracket.players, id]);
		search = '';
	}

	function save() {
		if (!bracket.name.trim()) {
			error = 'enter a name';
			return;
		}
		if (bracket.players.length != bracket.size) {
			error = `add ${bracket.size} players`;
			return;
		}

		const others = (items.current.brackets ?? []).filter((b) => b.id != bracket.id);
		items.current.brackets = [...others, $state.snapshot(bracket) as SavedBracket];
		popoverState = 'closed';
		clear();
	}

	function clear() {
		bracket = structuredClone($state.snapshot(initial) ?? newBracket());
		search = '';
		error = '';
	}
</script>

<PopOver title="{mode} bracket" bind:state={popoverState} clearfn={clear} onopen={clear}>
	<section class="grid grid-cols-12 gap-2">
		<label for="bracket-name" class="col-span-4">name</label>
		<input
			class="col-span-8 input"
			type="text"
			id="bracket-name"
			placeholder="name"
			bind:value={bracket.name}
		/>

		<span class="col-span-4">size</span>
		<div class="col-span-8">
			<RadioInputs
				opts={[...BracketSizes]}
				optlabels={BracketSizes.map((s) => `${s} players`)}
				bind:value={bracket.size}
				onchange={() => setPlayers(bracket.players.slice(0, bracket.size))}
			/>
		</div>

		<span class="col-span-4">elimination</span>
		<div class="col-span-8">
			<!-- a different format means different matches, so the results start over -->
			<RadioInputs
				opts={[...Eliminations]}
				bind:value={() => bracket.elimination ?? 'double', (e) => (bracket.elimination = e)}
				onchange={clearResults}
			/>
		</div>

		<hr class="hr" />

		<DraggablePlayerList
			bind:players={bracket.players}
			class="col-span-full"
			onchange={clearResults}
			onremove={() => {
				clearResults();
				error = '';
			}}
		/>

		<!-- MARK: Players -->
		{#if bracket.players.length < bracket.size}
			<label for="bracket-search" class="col-span-4">search players</label>
			<input
				class="col-span-8 input"
				type="text"
				id="bracket-search"
				placeholder="name"
				bind:value={search}
			/>
			{#each results as player (player.steamID3)}
				<div class="col-span-2">
					{#if player.avatarURL}
						<img
							src={player.avatarURL}
							alt=""
							class="size-10 rounded-xl object-cover object-center"
							draggable="false"
						/>
					{/if}
				</div>
				<div class="col-span-7">{player.name}</div>
				<button class="col-span-3 button" onclick={() => addPlayer(player.steamID3)}>add</button>
			{/each}
		{/if}

		<!-- MARK: Seeding -->
		<!-- who each seed plays first. Drag a player onto another to swap their seeds -->
		{#if bracket.players.length == bracket.size}
			<hr class="hr" />
			<h2 class="col-span-full text-xl">starting matches</h2>
			<StartingMatches
				size={bracket.size}
				elimination={bracket.elimination}
				bind:players={bracket.players}
				onchange={clearResults}
				class="col-span-full"
			/>
		{/if}

		<hr class="hr" />

		<button class="col-span-6 button" onclick={save}>{mode} bracket</button>
		<div class="col-span-6">{error}</div>
	</section>
</PopOver>
