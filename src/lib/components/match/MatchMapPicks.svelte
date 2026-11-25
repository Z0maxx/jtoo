<script lang="ts">
	import { getContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import PickAvatar from '$lib/components/maps/PickAvatar.svelte';
	import { fitText } from '$lib/fit-text';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { mapName, seriesOf } from '$lib/map-picks';
	import { overlay, settings } from '$lib/storage.svelte';
	import { getMap } from '$lib/util';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';

	// the series from the pick & ban session, as small versions of the map scene's series cards,
	// with the map being played lit and the rest dimmed
	let ksnWs: KSNWebSocket = getContext('ksnWs');

	let session = $derived(ksnWs.messages.mapPicks?.session ?? null);
	let cards = $derived.by(() => {
		if (!session || session.status === 'cancelled') return [];
		const s = session;
		return seriesOf(s).flatMap(({ mapId, actor }) => {
			const map = s.maps.find((m) => m.id === mapId);
			if (!map) return [];
			const player = actor && (actor === 'A' ? s.playerA : s.playerB);
			return [
				{
					id: mapId,
					key: map.name,
					name: mapName(map.name, map.displayName),
					image: getMap(map.name).imageURL ?? '',
					actor,
					player: player ? { name: player.displayName, avatar: player.avatarUrl } : undefined
				}
			];
		});
	});

	// the overlay's map, when it's one of the series
	let currentId = $derived.by(() => {
		if (!overlay.current.map) return undefined;
		const id = ksnWs.mapIdFor(overlay.current.map);
		return cards.some((c) => c.id === id) ? id : undefined;
	});
</script>

{#if cards.length > 1}
	<div transition:fade class="absolute bottom-4 left-4 z-1 flex w-200 flex-wrap gap-4">
		{#each cards as card, i (card.key)}
			{@const dimmed = currentId !== undefined && card.id !== currentId}
			<div class="relative h-32 w-55 overflow-hidden rounded-2xl">
				{#if card.image}
					<img
						in:fade
						src={card.image}
						alt=""
						class="absolute inset-0 size-full object-cover transition-[filter] duration-500"
						class:brightness-50={dimmed}
						draggable="false"
					/>
				{/if}
				<div class="absolute inset-0 bg-linear-to-t from-ctp-crust/90 to-transparent to-60%"></div>
				<span
					class="absolute right-3 bottom-2 left-3 truncate leading-none font-bold text-white uppercase"
					class:opacity-60={dimmed}
					{@attach fitText(30, settings.current.font, card.name)}
				>
					{card.name}
				</span>
				<!-- the map's number, with who picked it -->
				<div
					class="absolute top-2 left-2 flex items-center gap-2 rounded-lg bg-ctp-crust/85 py-1 pr-2.5 {card.player
						? 'pl-1'
						: 'pl-2.5'}"
				>
					{#if card.actor && card.player}
						<PickAvatar
							actor={card.actor}
							name={card.player.name}
							avatar={card.player.avatar}
							class="size-7 shrink-0 rounded-md text-base"
						/>
						<span class="text-lg leading-none font-bold text-white">MAP {i + 1}</span>
					{:else}
						<span
							class="py-1 text-lg leading-none font-bold text-white"
							style:filter={getFiltersStyle()}
						>
							MAP {i + 1}
						</span>
					{/if}
				</div>
				<!-- the map being played is outlined; on its own layer, so the colour filters
				     tint the outline and not the map's image -->
				<div
					class="pointer-events-none absolute inset-0 rounded-2xl ring-3 ring-ctp-lavender transition-opacity duration-500 ring-inset"
					class:opacity-0={card.id !== currentId}
					class:opacity-60={card.id == currentId}
					style:filter={getFiltersStyle()}
				></div>
			</div>
		{/each}
	</div>
{/if}
