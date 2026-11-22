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
		class="grid {settings.current.enableFlags
			? 'grid-cols-[repeat(6,auto)]'
			: 'grid-cols-[repeat(5,auto)]'} gap-x-6 gap-y-4 text-4xl"
	>
		<!-- avatar -->
		<li></li>
		{#if settings.current.enableFlags}
			<!-- flag -->
			<li></li>
		{/if}
		{@render Header('name')}
		{@render Header(`${tfClass} rank`)}
		{@render Header('world records')}
		{@render Header('top times')}

		<hr class="hr" />
		{#each poolPlayers().map((id) => getPlayer(id)) as player, i (i)}
			{#if player.name}
				{@render PlayerSnippet(player)}
				<hr class="hr" />
			{/if}
		{/each}
	</ul>
</section>

{#snippet Header(title: string)}
	<li class="pr-20 italic opacity-60" style:filter={getFiltersStyle()}>{title}</li>
{/snippet}

{#snippet PlayerSnippet(player: Player)}
	<li class="-mt-2 -mb-2">
		<img
			in:fade
			src={player.avatarURL}
			alt=""
			class="size-24 rounded-xl object-cover object-center"
			draggable="false"
		/>
	</li>
	{#if settings.current.enableFlags}
		<li class="-mt-2 -mb-2">
			{#if player.flag}
				<Flag code={player.flag} class="rounded-xl text-[6rem]" />
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
	<li class="-mt-2 -mb-2" style:filter={noFilter ? '' : getFiltersStyle()}>
		{content}
	</li>
{/snippet}
