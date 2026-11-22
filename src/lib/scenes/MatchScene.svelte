<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { settings, overlay, items, fundraisingState } from '$lib/storage.svelte';
	import { fade, slide } from 'svelte/transition';
	import WebSocketTimer from '$lib/components/match/WebSocketTimer.svelte';
	import Flag from '$lib/components/util/Flag.svelte';
	import { getContext } from 'svelte';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { getMap, getPlayer, msToFormattedTime } from '$lib/util';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import { Steam } from '$lib/api/steam/api-steam';
	import WebSocketLeader from '$lib/components/match/WebSocketLeader.svelte';
	import FundraisingSection from '$lib/components/fundraising/FundraisingSection.svelte';
	import DonationMessages from '$lib/components/fundraising/DonationMessages.svelte';

	// one scene for both match layouts, so switching between them animates the differences
	// instead of tearing one scene down and building the other
	type Props = { single?: boolean };
	let { single = false }: Props = $props();

	let ksnWs: KSNWebSocket = getContext('ksnWs');
	let live: ConsoleLive = getContext('consoleLive');
</script>

<!-- MARK: top bar -->
<div class="relative z-20 flex h-32 w-full justify-between p-4">
	{#if settings.current.ksnWebSocketToken !== ''}
		<!-- the box glides between the two layouts' timer positions -->
		<div
			class="absolute transition-all duration-500 ease-in-out
                {single ? 'top-6 left-[calc(46%-2.5rem)] w-[54%]' : 'top-11 left-[22.5%] w-[55%]'}"
		>
			{#key single}
				<div in:fade>
					<WebSocketTimer numPlayers={single ? 1 : 2} class="w-full" />
				</div>
			{/key}
		</div>
		{#if single}
			<!-- out of the flex flow, or it pushes player 1 away from the left edge -->
			<div transition:fade class="pointer-events-none absolute inset-0">
				<WebSocketLeader class="absolute top-4 right-90" />
			</div>
		{/if}
	{/if}
	<!-- gradients: both layouts' gradients stay in place and crossfade -->
	{#if settings.current.enableGradient}
		{#if settings.current.enableTeamColors}
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-blue/35 via-black/35 to-ctp-red/35 transition-opacity duration-500
                {single ? 'opacity-0' : ''}"
			></div>
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-blue/35 to-black/35 transition-opacity duration-500
                {single ? '' : 'opacity-0'}"
			></div>
		{:else}
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-lavender/35 via-black/35 to-ctp-lavender/35 transition-opacity duration-500
                {single ? 'opacity-0' : ''}"
				style:filter={getFiltersStyle()}
			></div>
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-lavender/35 to-black/35 transition-opacity duration-500
                {single ? '' : 'opacity-0'}"
				style:filter={getFiltersStyle()}
			></div>
		{/if}
	{:else}
		<!-- transparent black bg -->
		<div class="absolute top-0 left-0 size-full bg-black/35"></div>
	{/if}

	{@render OverlayPlayer(overlay.current.players[0], 0)}
	{#if !single}
		<div transition:fade class="h-full">
			{@render OverlayPlayer(overlay.current.players[1], 1)}
		</div>
	{/if}
</div>
<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<!-- MARK: POVs -->
{#if !single}
		<div
			class="aspect-video w-1/2
  {settings.current.enablePOVGuide
				? 'border-r-2 border-dashed border-ctp-lavender/50 bg-ctp-lavender/25'
				: ''}"
		>
      {#if settings.current.enableFundraisingSection}
        {#if fundraisingState.current.eventUrl}
          <FundraisingSection />
        {:else}
          <div class="text-6xl">Fundraising event is not set</div>
        {/if}
      {/if}
    </div>
		<div
			class="aspect-video w-1/2
  {settings.current.enablePOVGuide
				? 'border-l-2 border-dashed border-ctp-lavender/50 bg-ctp-lavender/25'
				: ''}"
		></div>
{/if}

<!-- MARK: bottom bar -->
<div class="flex h-16 w-full justify-between" style:filter={getFiltersStyle()}>
	<!-- stage -->
	<div
		class="relative -left-6 flex h-full -skew-x-30 items-center justify-end rounded-br-xl border-r-4 border-b-4 border-ctp-lavender/50 bg-ctp-lavender/25
                {overlay.current.stage === '' ? 'opacity-0' : ''}"
	>
		{#key overlay.current.stage}
			<span in:fade class="relative left-2 skew-x-30 px-8 text-2xl text-ctp-text/75"
				>{overlay.current.stage}</span
			>
		{/key}
	</div>

  {#if settings.current.enableFundraisingSection}
		<div class="absolute flex w-full items-start justify-center pt-2">
			<DonationMessages />
		</div>
	{/if}

	{#if settings.current.ksnWebSocketToken !== '' && !single}
		<div transition:fade>
			<WebSocketLeader />
		</div>
	{/if}
	<!-- map -->
	<div
		class="relative -right-6 flex h-full skew-x-30 items-center justify-end rounded-bl-xl border-b-4 border-l-4 border-ctp-lavender/50 bg-ctp-lavender/25
                {overlay.current.map === '' ? 'opacity-0' : ''}"
	>
		{#key overlay.current.stage}
			<span in:fade class="relative right-2 -skew-x-30 px-8 text-3xl text-ctp-text/75"
				>{settings.current.useShortMapNames
					? getMap(overlay.current.map).shortName
					: overlay.current.map}</span
			>
		{/key}
	</div>
</div>
<!-- MARK: map picks -->
<div class="absolute bottom-4 left-4 z-1 flex w-200 flex-wrap gap-4">
	{#if ksnWs.pickedMaps.length > 1}
		{#each ksnWs.pickedMaps as pickedMap, i (i)}
			{@const player = getPlayer(Steam.convertSteamId(pickedMap.steamID3, 'SteamID3') as number)}
			{@const mapId = ksnWs.mapIdFor(overlay.current.map)}
			{@const isCurrent = pickedMap.mapID == mapId}
			{@const map = () =>
				items.current.maps.find(
					(m) => m.fileName && ksnWs.mapIdFor(m.fileName) == pickedMap.mapID
				)}
			{#if map()}
				{@const MAP = map()!}
				<div
					class="@container relative h-32 w-55 border-ctp-lavender-900 text-3xl
                                                {settings.current.monoFont} rounded-2xl
                                                {isCurrent ? 'border-2' : ''}"
				>
					<!-- map name -->
					<h1
						class="absolute top-0 right-0 w-full p-2 text-center {settings.current.font}"
						style:filter={getFiltersStyle()}
					>
						{settings.current.useShortMapNames ? MAP.shortName : MAP.fileName}
					</h1>
					{#if player}
						{#if settings.current.enableAvatars && player.avatarURL}
							{#key player.avatarURL}
								<img
									in:fade
									src={player.avatarURL}
									alt=""
									class="absolute bottom-1 left-1 size-13 rounded-xl object-cover object-center"
									draggable="false"
								/>
							{/key}
						{/if}
					{/if}
					<img
						in:fade
						src={MAP.imageURL}
						alt=""
						class="absolute -z-10 h-full w-full rounded-xl object-cover {isCurrent
							? 'brightness-70'
							: 'brightness-50'}"
						draggable="false"
					/>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<!-- MARK: OverlayPlayer -->
{#snippet OverlayPlayer(steamID3: number | undefined, playerNum: number)}
	{@const player = getPlayer(steamID3)}
	{@const flag = player.flag}
	{@const avatarURL = player.avatarURL}
	{@const tag = player.tag}
	{@const name = player.name}
	{@const entry = live.entryFor(steamID3)}
	<div class="relative z-10 flex h-full gap-4 {playerNum === 1 ? 'flex-row-reverse' : ''}">
		<!-- flag -->
		{#if settings.current.enableFlags && flag}
			<Flag code={flag} class="flex h-fit w-fit rounded-xl text-[6rem]" />
		{/if}
		{#if settings.current.enableAvatars && avatarURL}
			{#key avatarURL}
				<img
					in:fade
					src={avatarURL}
					alt=""
					class="size-24 rounded-xl object-cover object-center"
					draggable="false"
				/>
			{/key}
		{/if}
		<div
			class="flex flex-col {playerNum === 1 ? 'items-end' : 'items-start'}"
			style:filter={getFiltersStyle()}
		>
			<div class="mb-3 flex gap-2">
				<!-- tag -->
				{#if settings.current.enableTags && tag}
					{#key tag}
						<span in:fade class="text-4xl text-ctp-text/75">{tag}</span>
					{/key}
				{/if}
				<!-- name: a little bigger when it's the only player -->
				{#key name}
					<span
						in:fade
						class="font-bold transition-[font-size] duration-500
                        {single ? 'text-4xl' : 'text-3xl'}">{name}</span
					>
				{/key}
			</div>
			<!-- PRs -->
			<div
				class="flex gap-2 text-ctp-text/75
                                {playerNum === 1 ? 'flex-row-reverse' : ''}"
			>
				<div
					class="-mt-4 mr-2 ml-2 flex h-16 max-w-55 flex-wrap items-center
                                        {playerNum === 1 ? 'flex-row-reverse' : ''}
                                        {settings.current.monoFont}"
				>
					{#if settings.current.enablePRs}
						<div class="flex gap-2">
							{#if entry && entry.prMs !== null}
								<span class="text-xl opacity-80 {settings.current.font}">pr</span>
								<span class="text-3xl">
									{msToFormattedTime(entry.prMs)}
								</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/snippet}
