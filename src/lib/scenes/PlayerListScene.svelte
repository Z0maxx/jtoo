<script lang="ts">
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { items, overlay, settings } from '$lib/storage.svelte';
	import { Player } from '$lib/types.svelte';
	import { fade } from 'svelte/transition';
	import Flag from '$lib/components/util/Flag.svelte';
	import { poolPlayers } from '$lib/console-pools.svelte';
	import { getPlayer } from '$lib/util';

	let tfClass = $derived(settings.current.tfClass ?? 'soldier');

	// compact rows so 16 fit on a 1080p canvas: 48px rows, 2px dividers and 4px gaps
	const MAX_PLAYERS = 16;
	let players = $derived(
		poolPlayers()
			.map((id) => getPlayer(id))
			.filter((p) => p.name)
			.slice(0, MAX_PLAYERS)
	);
</script>

<SceneFrame layout="centered" class="gap-10">
	<ul
		class="grid items-center gap-x-6 gap-y-1 text-3xl"
		style:grid-template-columns="repeat({(settings.current.enableAvatars ? 1 : 0) +
			(settings.current.enableFlags ? 1 : 0) +
			4}, auto)"
	>
		{#if settings.current.enableAvatars}
			<!-- avatar -->
			<li></li>
		{/if}
		{#if settings.current.enableFlags}
			<!-- flag -->
			<li></li>
		{/if}
		{@render Header('name')}
		{@render Header(`${tfClass} rank`)}
		{@render Header('world records')}
		{@render Header('top times')}

		<hr class="hr my-0" />
		{#each players as player, i (i)}
			{@render PlayerSnippet(player)}
			<hr class="hr my-0" />
		{/each}
	</ul>
</SceneFrame>

{#snippet Header(title: string)}
	<li class="pr-20 italic opacity-60" style:filter={getFiltersStyle()}>{title}</li>
{/snippet}

{#snippet PlayerSnippet(player: Player)}
	{#if settings.current.enableAvatars}
		<li class="size-12">
			{#if player.avatarURL}
				<img
					in:fade
					src={player.avatarURL}
					alt=""
					class="size-12 rounded-lg object-cover object-center"
					draggable="false"
				/>
			{/if}
		</li>
	{/if}
	{#if settings.current.enableFlags}
		<li class="flex h-12 items-center">
			{#if player.flag}
				<Flag code={player.flag} class="rounded-md text-[2.25rem]" />
			{/if}
		</li>
	{/if}
	{@render BodyCell(player.name)}
	<!-- ranks, WRs and TTs come from Tempus Plaza, and aren't there for every player -->
	{@render BodyCell(`${player.rank?.[tfClass]?.rank ?? '-'}`)}
	{@render BodyCell(`${player.WRs?.[tfClass] ?? '-'}`)}
	{@render BodyCell(`${player.TTs?.[tfClass] ?? '-'}`)}
{/snippet}

{#snippet BodyCell(content: string, noFilter: boolean = false)}
	<li class="flex h-12 items-center" style:filter={noFilter ? '' : getFiltersStyle()}>
		{content}
	</li>
{/snippet}
