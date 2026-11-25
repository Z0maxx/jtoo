<script lang="ts">
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import { pool, settings } from '$lib/storage.svelte';
	import { getMap, getPlayer } from '$lib/util';
	import { poolMaps, poolPlayers } from '$lib/console-pools.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';

	let live: ConsoleLive = getContext('consoleLive');

	// the console tournament's name, or the imported player pool's
	let name = $derived(live.tournament?.name ?? pool.current.playerPoolName ?? '');
</script>

<SceneFrame class="gap-10">
	<SceneHeader title={name} />
	<div class="grid grid-cols-12">
		<div class="col-span-8 row-start-1 flex">prizepool info</div>
		<div class="col-span-8 row-start-2 flex">
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
		<div class="col-span-4 row-span-2 row-start-1 flex">
			{#each poolMaps() as mapFilename, i (i)}
				{@const map = getMap(mapFilename)}
				<div>
					<img src={map.imageURL} alt={map.shortName} />
					<div>{map.shortName}</div>
				</div>
			{/each}
		</div>
	</div>
</SceneFrame>
