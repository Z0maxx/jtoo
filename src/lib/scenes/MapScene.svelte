<script lang="ts">
	import SceneTint from '$lib/components/SceneTint.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { settings, overlay } from '$lib/storage.svelte';
	import { crossfade, fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { getContext } from 'svelte';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { getMap } from '$lib/util';
	import { poolMaps } from '$lib/console-pools.svelte';
	import { now } from '$lib/clock.svelte';
	import { fitText } from '$lib/fit-text';
	import jfLogo from '$lib/assets/jf-logo.png';

	const EVENT_NAME = 'Jump4Charity';

	let ksnWs: KSNWebSocket = getContext('ksnWs');

	type Actor = 'A' | 'B';
	type Tile = {
		id: string; // the pick & ban id, or the file name before a session
		key: string; // the file name in every phase, so a map's tile carries across them
		name: string;
		image: string;
	};

	// maps move between the phases' layouts: picked and banned tiles fly from the grid into the
	// series and the ban strip, and back again when the session ends
	const [send, receive] = crossfade({
		duration: 700,
		easing: cubicOut,
		fallback: (node) => fade(node, { duration: 300 })
	});

	// the scene follows the pick & ban session: no session shows the pool, a running one the
	// picks as they happen, a completed one the series in play order
	let session = $derived(ksnWs.messages.mapPicks?.session ?? null);
	let phase: 'pool' | 'picking' | 'done' = $derived(
		!session || session.status === 'cancelled'
			? 'pool'
			: session.status === 'completed'
				? 'done'
				: 'picking'
	);

	// the outros are global so maps fly between the phases' layouts, but global outros also run
	// when the whole scene is swapped out, keeping it on screen over the next scene. the phase the
	// last render settled on tells them apart: an outro started while it still matches the phase
	// isn't a phase change, and one whose map is still in the pool isn't a map leaving the pool,
	// so the scene itself is leaving and the outro is skipped
	let settledPhase: typeof phase | undefined;
	$effect(() => {
		settledPhase = phase;
	});
	const sceneLeaving = (key?: string) =>
		phase === settledPhase && (key === undefined || tiles.some((t) => t.key === key));
	const sendOut: typeof send = (node, params) =>
		sceneLeaving(params.key) ? () => ({ duration: 0 }) : send(node, params);
	const fadeOut: typeof fade = (node, params) =>
		sceneLeaving() ? { duration: 0 } : fade(node, params);
	// global intros likewise run when the scene is swapped in: before the first render settles,
	// everything shown is the scene arriving, so it appears at once
	const sceneEntering = () => settledPhase === undefined;
	const receiveIn: typeof receive = (node, params) =>
		sceneEntering() ? () => ({ duration: 0 }) : receive(node, params);
	const fadeIn: typeof fade = (node, params) =>
		sceneEntering() ? { duration: 0 } : fade(node, params);
	const flyIn: typeof fly = (node, params) =>
		sceneEntering() ? { duration: 0 } : fly(node, params);

	function mapName(fileName: string, fallback?: string | null): string {
		const map = getMap(fileName);
		if (!map.fileName) return fallback || fileName;
		return settings.current.useShortMapNames ? map.shortName : map.fileName;
	}

	// the session's maps once it starts, the imported pool before that
	let tiles: Tile[] = $derived(
		session
			? session.maps.map((m) => ({
					id: m.id,
					key: m.name,
					name: mapName(m.name, m.displayName),
					image: getMap(m.name).imageURL ?? ''
				}))
			: poolMaps()
					.map((f) => getMap(f))
					.filter((m) => m.fileName)
					.map((m) => ({
						id: m.fileName,
						key: m.fileName,
						name: mapName(m.fileName),
						image: m.imageURL ?? ''
					}))
	);
	let tileById = $derived(new Map(tiles.map((t) => [t.id, t])));

	// the pool's tiles share the space left under the heading: 4 to a row, gap-8 (2rem) between.
	// during picks they're a fixed size, leaving room for the turn bar; the size eases between them
	const POOL_COLUMNS = 4;
	let poolRows = $derived(Math.max(1, Math.ceil(tiles.length / POOL_COLUMNS)));
	// measured rather than percentages: browsers don't animate a percentage height to a fixed one
	let gridWidth = $state(0);
	let gridHeight = $state(0);
	let tileWidth = $derived(
		phase === 'pool' && gridWidth
			? `calc((${gridWidth}px - ${POOL_COLUMNS - 1} * 2rem) / ${POOL_COLUMNS})`
			: '25.5rem'
	);
	let tileHeight = $derived(
		phase === 'pool' && gridHeight
			? `calc((${gridHeight}px - ${poolRows - 1} * 2rem) / ${poolRows})`
			: '14.75rem'
	);

	// MARK: players
	// only the session's players: without a session the pool is shown on its own, not as a match
	const noPlayer = { name: '', avatar: '' };
	let players = $derived(
		session
			? {
					A: { name: session.playerA.displayName, avatar: session.playerA.avatarUrl },
					B: { name: session.playerB.displayName, avatar: session.playerB.avatarUrl }
				}
			: { A: noPlayer, B: noPlayer }
	);
	const teamText: Record<Actor, string> = { A: 'text-ctp-blue', B: 'text-ctp-red' };
	const teamBg: Record<Actor, string> = { A: 'bg-ctp-blue', B: 'bg-ctp-red' };
	const teamOutline: Record<Actor, string> = { A: 'outline-ctp-blue', B: 'outline-ctp-red' };

	// the stage and series length belong to the match, so they only show once a session starts
	let matchTag = $derived(
		session
			? [overlay.current.stage, `Bo${session.config.seriesLength}`].filter(Boolean).join(' · ')
			: ''
	);

	// MARK: picks and bans
	type Result = { actor: Actor; action: 'pick' | 'ban'; pickNo: number };
	let results = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const byMap = new Map<string, Result>();
		let pickNo = 0;
		for (const step of session?.history ?? []) {
			byMap.set(step.mapId, {
				actor: step.actor,
				action: step.action,
				pickNo: step.action === 'pick' ? ++pickNo : 0
			});
		}
		return byMap;
	});

	// the map left over once every step is done; it's played last when picks don't fill the series
	let decider = $derived.by(() => {
		if (!session) return undefined;
		const picks = session.history.filter((h) => h.action === 'pick').length;
		if (picks >= session.config.seriesLength) return undefined;
		const left = tiles.filter((t) => !results.has(t.id));
		return left.length === 1 ? left[0] : undefined;
	});

	let series = $derived.by(() => {
		const played: { tile: Tile; actor?: Actor }[] = (session?.history ?? [])
			.filter((h) => h.action === 'pick')
			// the console adds the leftover map as an 'elimination' pick when the steps run out:
			// that's the decider, nobody's pick
			.map((h) => ({
				tile: tileById.get(h.mapId)!,
				actor: h.resolvedBy === 'elimination' ? undefined : h.actor
			}))
			.filter((p) => p.tile);
		if (decider) played.push({ tile: decider });
		return played;
	});
	let bans = $derived(
		(session?.history ?? [])
			.filter((h) => h.action === 'ban')
			.map((h) => ({ tile: tileById.get(h.mapId)!, actor: h.actor }))
			.filter((b) => b.tile)
	);

	// the step track: every step of the order, then the decider when there is one
	let steps = $derived.by(() => {
		if (!session) return [];
		const s = session;
		const track: {
			label: string;
			result: string;
			actor?: Actor;
			state: 'done' | 'now' | 'later';
		}[] = s.steps.map((step, i) => {
			const done = s.history.find((h) => h.stepIndex === step.index);
			return {
				label: `${step.actor} ${step.action}`,
				result: done
					? (tileById.get(done.mapId)?.name ?? '')
					: i === s.currentStepIndex
						? 'picking...'
						: '—',
				actor: step.actor,
				state: done ? 'done' : i === s.currentStepIndex ? 'now' : 'later'
			};
		});
		const picks = s.steps.filter((st) => st.action === 'pick').length;
		if (picks < s.config.seriesLength) {
			track.push({ label: 'decider', result: decider?.name ?? '—', state: 'later' });
		}
		return track;
	});

	// MARK: turn timer
	let turn = $derived(session?.status === 'running' ? session.currentTurn : undefined);
	let remainingMs = $derived(turn ? Math.max(0, Date.parse(turn.expiresAt) - now()) : 0);
	let turnMs = $derived(
		turn
			? Date.parse(turn.expiresAt) - Date.parse(turn.startedAt) ||
					(session?.config.turnTimeLimitSeconds ?? 0) * 1000
			: 0
	);
	let remainingText = $derived.by(() => {
		const s = Math.ceil(remainingMs / 1000);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	});
</script>

<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<section
	class="relative z-20 flex min-h-0 w-full grow flex-col gap-10 px-24 py-14 text-ctp-text {settings
		.current.font}"
>
	<SceneTint class="-z-10" />

	<header class="flex items-start justify-between gap-12">
		<!-- flex-1 gives the column the header's spare width, which the heading shrinks to fit -->
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="text-2xl tracking-[0.18em] text-ctp-subtext0 uppercase">{EVENT_NAME}</span>
			{#key phase === 'pool'}
				<h1
					in:fade={{ duration: 400 }}
					class="leading-none font-bold tracking-tight text-white uppercase"
					{@attach fitText(112, settings.current.font)}
				>
					{phase === 'pool' ? 'Maps' : 'Map Picks'}
				</h1>
			{/key}
			{#if players.A.name && players.B.name}
				<span
					transition:slide={{ duration: 500, easing: cubicOut }}
					class="truncate text-5xl leading-tight font-bold uppercase"
				>
					<span class={teamText.A}>{players.A.name}</span>
					<span class="font-medium text-ctp-subtext0">vs.</span>
					<span class={teamText.B}>{players.B.name}</span>
				</span>
			{/if}
		</div>
		<div class="flex shrink-0 flex-col items-end gap-4">
			<img src={jfLogo} alt="Jump Fortress" class="size-32 object-contain" draggable="false" />
			{#if matchTag}
				<span
					transition:fade
					class="border-2 border-ctp-lavender/35 bg-ctp-lavender/10 px-5 py-2 text-3xl font-bold text-white uppercase"
				>
					{matchTag}
				</span>
			{/if}
		</div>
	</header>

	<!-- both views share one cell, so the outgoing one stays in place while maps fly out of it -->
	<div class="grid min-h-0 flex-1 *:[grid-area:1/1]">
		{#if phase === 'done'}
			<!-- C: the series in play order, then the bans -->
			<div class="flex min-h-0 flex-col gap-10">
				<div
					class="grid gap-8"
					style:grid-template-columns="repeat({series.length}, minmax(0, 1fr))"
				>
					{#each series as map, i (map.tile.key)}
						<div class="flex flex-col gap-4">
							<div
								class="flex items-baseline justify-between gap-4"
								in:fadeIn|global={{ delay: 400 }}
								out:fadeOut|global={{ duration: 200 }}
							>
								<span class="text-4xl font-bold text-white uppercase">Map {i + 1}</span>
								<span
									class="truncate text-2xl font-semibold {map.actor ? teamText[map.actor] : ''}"
									style:filter={map.actor ? '' : getFiltersStyle()}
								>
									{map.actor ? `${players[map.actor].name}'s pick` : 'Decider'}
								</span>
							</div>
							<div
								in:receiveIn|global={{ key: map.tile.key }}
								out:sendOut|global={{ key: map.tile.key }}
								class="relative h-100 overflow-hidden rounded-3xl outline-4 {map.actor
									? teamOutline[map.actor]
									: 'outline-ctp-lavender'}"
							>
								{@render MapImage(map.tile.image)}
								<div
									class="absolute inset-0 bg-linear-to-t from-ctp-crust/90 to-transparent to-60%"
								></div>
								<span
									class="absolute right-7 bottom-5 left-7 truncate text-6xl font-bold text-white uppercase"
								>
									{map.tile.name}
								</span>
							</div>
						</div>
					{/each}
				</div>

				{#if bans.length}
					<div class="mt-auto flex items-center gap-8">
						<span
							class="shrink-0 text-2xl tracking-[0.16em] text-ctp-subtext0 uppercase"
							in:fadeIn|global={{ delay: 400 }}
							out:fadeOut|global={{ duration: 200 }}>Banned</span
						>
						<div
							class="grid grow gap-5"
							style:grid-template-columns="repeat({bans.length}, minmax(0, 1fr))"
						>
							{#each bans as ban (ban.tile.key)}
								<div
									in:receiveIn|global={{ key: ban.tile.key }}
									out:sendOut|global={{ key: ban.tile.key }}
									class="flex items-center gap-4 rounded-xl border-2 border-ctp-lavender/15 bg-ctp-lavender/5 p-2"
								>
									<div
										class="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg brightness-50 grayscale"
									>
										{@render MapImage(ban.tile.image)}
									</div>
									<div class="flex min-w-0 flex-col">
										<span
											class="truncate text-3xl font-bold text-ctp-subtext0 uppercase line-through"
										>
											{ban.tile.name}
										</span>
										<span class="truncate text-xl font-semibold {teamText[ban.actor]}">
											{players[ban.actor].name}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- A and B: the pool, marked with picks and bans as they come in -->
			<div class="flex min-h-0 flex-col gap-10">
				<div
					class="flex min-h-0 flex-1 flex-wrap content-start justify-center gap-8"
					bind:clientWidth={gridWidth}
					bind:clientHeight={gridHeight}
				>
					{#each tiles as tile (tile.key)}
						{@const r = results.get(tile.id)}
						<div
							in:receiveIn|global={{ key: tile.key }}
							out:sendOut|global={{ key: tile.key }}
							style:width={tileWidth}
							style:height={tileHeight}
							class="relative overflow-hidden rounded-2xl transition-[width,height] duration-700 ease-out {r?.action ===
							'pick'
								? `outline-4 ${teamOutline[r.actor]}`
								: 'outline-2 outline-ctp-lavender/25'}"
						>
							<div
								class="absolute inset-0 transition-[filter] duration-500"
								class:grayscale={r?.action === 'ban'}
								class:brightness-35={r?.action === 'ban'}
							>
								{@render MapImage(tile.image)}
							</div>
							<div
								class="absolute inset-0 bg-linear-to-b from-ctp-crust/85 to-transparent to-55%"
							></div>
							<span
								class="absolute top-3 right-5 left-5 truncate text-4xl font-bold text-white uppercase"
								class:line-through={r?.action === 'ban'}
								class:opacity-60={r?.action === 'ban'}
							>
								{tile.name}
							</span>
							{#if r?.action === 'pick'}
								<span
									transition:fade
									class="absolute top-4 right-4 rounded-lg px-3.5 py-1 text-2xl font-bold tracking-wide text-ctp-crust {teamBg[
										r.actor
									]}"
								>
									MAP {r.pickNo}
								</span>
							{/if}
							{#if r}
								<div
									transition:fade
									class="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl bg-ctp-crust/85 py-1.5 pr-3.5 pl-1.5"
								>
									{@render Avatar(r.actor, 'size-10 rounded-lg text-xl')}
									<span class="text-2xl font-semibold text-white">
										{r.action === 'pick' ? 'Picked' : 'Banned'} by {players[r.actor].name}
									</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if phase === 'picking' && session}
					<div
						class="flex flex-col gap-4"
						in:flyIn|global={{ y: 60, duration: 500, easing: cubicOut }}
						out:fadeOut|global={{ duration: 200 }}
					>
						{#if turn}
							<div class="flex items-baseline justify-between">
								<span class="text-5xl font-bold text-white">
									<span class={teamText[turn.actor]}>{players[turn.actor].name}</span>
									is {turn.action === 'pick' ? 'picking' : 'banning'}
								</span>
								<span
									class="text-4xl font-semibold tabular-nums
                                                        {settings.current.monoFont}"
								>
									{remainingText}
								</span>
							</div>
							<div class="h-3.5 overflow-hidden rounded-full bg-ctp-lavender/15">
								<div
									class="h-full rounded-full {teamBg[turn.actor]}"
									style:width="{turnMs ? (remainingMs / turnMs) * 100 : 0}%"
								></div>
							</div>
						{/if}
						<div
							class="grid gap-3"
							style:grid-template-columns="repeat({steps.length}, minmax(0, 1fr))"
						>
							{#each steps as step, i (i)}
								<div
									class="flex min-w-0 flex-col rounded-xl border-2 px-3.5 py-2.5
								{step.state === 'now'
										? `bg-ctp-lavender/10 ${step.actor === 'A' ? 'border-ctp-blue' : step.actor === 'B' ? 'border-ctp-red' : 'border-ctp-text'}`
										: 'border-ctp-lavender/20'}"
									class:opacity-50={step.state === 'later'}
								>
									<span
										class="text-lg font-bold tracking-widest uppercase {step.actor
											? teamText[step.actor]
											: 'text-ctp-text'}"
									>
										{step.label}
									</span>
									<span class="truncate text-2xl font-medium text-white">{step.result}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>

{#snippet MapImage(src: string)}
	{#if src}
		<img in:fade {src} alt="" class="absolute inset-0 size-full object-cover" draggable="false" />
	{/if}
{/snippet}

{#snippet Avatar(actor: Actor, className: string)}
	{#if settings.current.enableAvatars && players[actor].avatar}
		<img src={players[actor].avatar} alt="" class="object-cover {className}" draggable="false" />
	{:else}
		<span
			class="flex items-center justify-center font-bold text-ctp-crust {teamBg[actor]} {className}"
		>
			{players[actor].name.slice(0, 1).toUpperCase()}
		</span>
	{/if}
{/snippet}
