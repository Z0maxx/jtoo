<script lang="ts">
	import PopOver from './PopOver.svelte';
	import RadioInputs from './RadioInputs.svelte';
	import SeedBracket from './SeedBracket.svelte';
	import DraggablePlayerList from '../DraggablePlayerList.svelte';
	import { items } from '$lib/storage.svelte';
	import { BracketSizes, newBracket, type SavedBracket, type SteamID3 } from '$lib/types.svelte';
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

	// the seeding is rebuilt whenever the players change
	function setPlayers(players: SteamID3[]) {
		bracket = { ...bracket, players, bracket: undefined };
		error = '';
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
		if (bracket.players.length != bracket.size || !bracket.bracket) {
			error = `add ${bracket.size} players and seed the bracket`;
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
			class="input col-span-8"
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

		<hr class="hr" />

		<DraggablePlayerList
			bind:players={bracket.players}
			class="col-span-full"
			onchange={() => (bracket.bracket = undefined)}
			onremove={() => {
				bracket.bracket = undefined;
				error = '';
			}}
		/>

		<!-- MARK: Players -->
		{#if bracket.players.length < bracket.size}
			<label for="bracket-search" class="col-span-4">search players</label>
			<input
				class="input col-span-8"
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
				<button class="button col-span-3" onclick={() => addPlayer(player.steamID3)}>add</button>
			{/each}
		{/if}

		<!-- MARK: Seeding -->
		{#if bracket.players.length == bracket.size}
			<hr class="hr" />
			<div class="col-span-full">
				{#key bracket.players}
					<SeedBracket
						container={false}
						size={bracket.size}
						players={bracket.players}
						bind:bracket={bracket.bracket}
					/>
				{/key}
			</div>
		{/if}

		<hr class="hr" />

		<button class="button col-span-6" onclick={save}>{mode} bracket</button>
		<div class="col-span-6">{error}</div>
	</section>
</PopOver>
