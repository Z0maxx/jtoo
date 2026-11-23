<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { items, overlay, settings } from '$lib/storage.svelte';
	import { Player } from '$lib/types.svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Flag from '$lib/components/util/Flag.svelte';
	import { poolPlayers } from '$lib/console-pools.svelte';
	import { getPlayer } from '$lib/util';

	let tfClass = $derived(settings.current.tfClass ?? 'soldier');

	const drawBG: boolean = !page.url.searchParams.has('nobg');

	// compact rows so 16 fit on a 1080p canvas: 48px rows, 2px dividers and 4px gaps
	const MAX_PLAYERS = 16;
	let players = $derived(
		poolPlayers()
			.map((id) => getPlayer(id))
			.filter((p) => p.name)
			.slice(0, MAX_PLAYERS)
	);
</script>

<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<section class="relative z-20 m-auto flex w-full justify-center gap-10 p-4">
	{#if drawBG}
		{#if settings.current.enableGradient}
			<!-- gradients -->
			{#if settings.current.enableTeamColors}
				<div
					class="absolute top-0 left-0 -z-10 size-full bg-linear-to-r from-ctp-blue/35 via-black/35 to-ctp-red/35"
				></div>
			{:else}
				<div
					class="absolute top-0 left-0 -z-10 size-full bg-linear-to-r from-ctp-lavender/35 via-black/35 to-ctp-lavender/35"
					style:filter={getFiltersStyle()}
				></div>
			{/if}
		{:else}
			<!-- transparent black bg -->
			<div class="absolute top-0 left-0 size-full bg-black/35"></div>
		{/if}
	{/if}
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
</section>

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
