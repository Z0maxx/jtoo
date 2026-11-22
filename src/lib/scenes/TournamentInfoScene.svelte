<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { pool, settings } from '$lib/storage.svelte';
	import { getMap, getPlayer } from '$lib/util';
	import { poolMaps, poolPlayers } from '$lib/console-pools.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';

	let live: ConsoleLive = getContext('consoleLive');

	// the console tournament's name, or the imported player pool's
	let name = $derived(live.tournament?.name ?? pool.current.playerPoolName ?? '');
</script>

<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<section>
	<div class="grid grid-cols-12">
		<div class="col-span-full flex">
			<h1 class="text-6xl">{name}</h1>
		</div>
		<div class="col-span-8 row-start-2 flex">prizepool info</div>
		<div class="col-span-8 row-start-3 flex">
			{#each poolPlayers() as playerId, i (i)}
				{@const player = getPlayer(playerId)}
				<div>
					{#if settings.current.enableAvatars && player.avatarURL}
						<img src={player.avatarURL} alt="{player.name}'s avatar" />
					{/if}
					<div>{player.name}</div>
				</div>
			{/each}
		</div>
		<div class="col-span-4 row-span-2 row-start-2 flex">
			{#each poolMaps() as mapFilename, i (i)}
				{@const map = getMap(mapFilename)}
				<div>
					<img src={map.imageURL} alt={map.shortName} />
					<div>{map.shortName}</div>
				</div>
			{/each}
		</div>
	</div>
</section>
