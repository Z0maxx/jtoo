<script lang="ts">
	import Accordion from '$lib/components/controls/Accordion.svelte';
	import Checkbox from '$lib/components/controls/Checkbox.svelte';
	import ConfirmButton from '$lib/components/controls/ConfirmButton.svelte';
	import ConnectionPanel, { feedStates } from '$lib/components/controls/ConnectionPanel.svelte';
	import ItemInput from '$lib/components/controls/ItemInput.svelte';
	import RangeInput from '$lib/components/controls/RangeInput.svelte';
	import RadioInputs from '$lib/components/controls/RadioInputs.svelte';
	import Importplayer from '$lib/components/controls/ImportPlayer.svelte';
	import ImportMap from '$lib/components/controls/ImportMap.svelte';
	import ManagePlayers from '$lib/components/controls/ManagePlayers.svelte';
	import ManageMaps from '$lib/components/controls/ManageMaps.svelte';
	import EditBracket from '$lib/components/controls/EditBracket.svelte';
	import ManageBrackets from '$lib/components/controls/ManageBrackets.svelte';

	import PlayerControl from '$lib/components/controls/PlayerControl.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import {
		settings,
		overlay,
		items,
		defaultStages,
		defaultSettings,
		resetVisualSettings
	} from '$lib/storage.svelte';
	import {
		BrokenOverlayScenes,
		Fonts,
		MonoFonts,
		OverlayScenes,
		IdleOverlayScenes,
		TFClasses
	} from '$lib/types.svelte';
	// import * as _ from 'underscore';

	import { obsConnect, obsStatus, setScene } from '$lib/websockets/obs/ws-obs.svelte';
	import { idleOBSSceneName } from '$lib/obs-browser-source.svelte';
	import { importConsolePools, poolMaps, type PoolImportResult } from '$lib/console-pools.svelte';
	import { fetchConsoleTournaments, type ConsoleTournamentList } from '$lib/console-tournaments';

	import { KSNWebSocketController } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { ConsoleLive, type FeedState } from '$lib/websockets/console/console-live.svelte';
	import { getMap, consoleBaseUrl } from '$lib/util';
	import { slide } from 'svelte/transition';
	import { onMount, setContext, untrack } from 'svelte';
	import { JFRelayWebSocket } from '$lib/websockets/jf-relay/js-relay.svelte';
	import SetFundraisingEvent from '$lib/components/controls/SetFundraisingEvent.svelte';

	type Error = { state: boolean; msg: string };
	import { refreshSchedule, schedule, scheduleDays, scheduleSheetUrl } from '$lib/schedule.svelte';

	let ksnWs: KSNWebSocketController | undefined = $state();
	// the console's progress channel: the RTD relay, and the progress that sorts mass-single races'
	// player lists. Created here, not on mount, so the player controls can get it from context
	const jfRelayWs = new JFRelayWebSocket();
	setContext('jfRelayWs', jfRelayWs);

	// tell the relay who player A and B are whenever they change, whether picked here or selected
	// by the overlay when a duel race starts; not on load, only on a change
	let relayedPlayers: string | undefined;
	$effect(() => {
		const players = [overlay.current.players[0], overlay.current.players[1]];
		const key = JSON.stringify(players);
		if (relayedPlayers !== undefined && key !== relayedPlayers) {
			untrack(() => jfRelayWs?.broadcastSelectedPlayers(players));
		}
		relayedPlayers = key;
	});
	// any settings change re-runs whatever reads settings.current, so the effects that switch the
	// OBS scene and connect the relay read these instead: they only change when the value does.
	// read straight from settings, picking an idle scene (a settings change) would switch OBS
	// straight back to the overlay scene
	const overlayScene = $derived(settings.current.overlayScene);
	const rtdEnabled = $derived(settings.current.enableFundraisingRtd);

	// the controls open their own race feed, to show whether the console is reachable and to
	// order the player lists by the race's leaderboard, and follow the overlay's tournament to
	// list its rounds for the leaderboard scene
	const live = new ConsoleLive({ tournament: true });
	setContext('consoleLive', live);
	$effect(() => {
		live.pinTournament(overlay.current.tournament || null);
	});
	// only the rounds that count toward the standings: finalized and not voided
	let leaderboardRounds = $derived(
		(live.tournament?.rounds ?? [])
			.filter((r) => r.finalized && !r.voided)
			.sort((a, b) => a.roundIndex - b.roundIndex)
	);

	// the event's players and maps come from console pools, imported on every startup
	let poolImport: PoolImportResult | 'importing' | undefined = $state();
	async function importPools() {
		poolImport = 'importing';
		poolImport = await importConsolePools();
	}

	// the console's tournaments, for picking the one the leaderboard scene shows
	let tournaments: ConsoleTournamentList | undefined = $state();
	let tournamentsError = $state('');
	async function loadTournaments() {
		const token = settings.current.ksnWebSocketToken.trim();
		if (!token) return;
		try {
			tournaments = await fetchConsoleTournaments(token);
			tournamentsError = '';
		} catch (e) {
			tournamentsError = e instanceof Error ? e.message : `${e}`;
		}
	}

	function connectConsole() {
		const token = settings.current.ksnWebSocketToken.trim();
		ksnWs!.connect(token);
		live.connect(token, consoleBaseUrl());
		loadTournaments();
	}

	// the relay reports a websocket readyState instead
	const relayState = $derived<FeedState>(
		jfRelayWs.wsState === WebSocket.OPEN
			? 'open'
			: jfRelayWs.wsState === WebSocket.CONNECTING
				? 'connecting'
				: 'closed'
	);

	let error = $state({
		invalidJfRelayToken: {
			state: false,
			msg: 'error: invalid jf relay websocket token'
		} as Error
	});

	// MARK: status bar
	// each status opens its connection's settings right below the bar, one at a time
	type StatusId = 'obs' | 'console' | 'relay';
	let openStatus: StatusId | null = $state(null);

	// 'off' is a connection that isn't set up, which isn't worth a red dot
	type Status = FeedState | 'off';
	const statusDots: Record<Status, string> = {
		connecting: 'bg-yellow-200',
		open: 'bg-green-300',
		closed: 'bg-red-300',
		off: 'bg-ctp-text/30'
	};
	// the console is two things: the live race feed (needs the token) and the startup import of
	// the event's player and map pools (public). its dot shows whichever is worse
	const poolStatus = $derived<Status>(
		poolImport === undefined
			? 'off'
			: poolImport === 'importing'
				? 'connecting'
				: poolImport.errors.length
					? 'closed'
					: 'open'
	);
	const statusRank: Record<Status, number> = { open: 0, off: 1, connecting: 2, closed: 3 };
	const consoleStatus = $derived.by<Status>(() => {
		const feed: Status = settings.current.ksnWebSocketToken ? live.raceState : 'off';
		return statusRank[poolStatus] > statusRank[feed] ? poolStatus : feed;
	});
	const statuses = $derived<{ id: StatusId; status: Status; detail: string }[]>([
		{
			id: 'obs',
			status: settings.current.obsWsPw ? obsStatus.state : 'off',
			detail: obsStatus.error || (settings.current.obsWsPw ? '' : 'no password set')
		},
		{
			id: 'console',
			status: consoleStatus,
			detail: [
				live.dummy
					? 'showing dummy data'
					: settings.current.ksnWebSocketToken
						? ''
						: 'no token set',
				poolStatus === 'closed' && poolImport && poolImport !== 'importing'
					? `pool import failed: ${poolImport.errors.join(', ')}`
					: poolStatus === 'connecting'
						? 'importing pools'
						: ''
			]
				.filter(Boolean)
				.join('; ')
		},
		{
			id: 'relay',
			status: settings.current.jfRelayWebSocketToken ? relayState : 'off',
			detail: error.invalidJfRelayToken.state
				? error.invalidJfRelayToken.msg
				: settings.current.jfRelayWebSocketToken
					? ''
					: 'no token set'
		}
	]);
	const statusText: Record<Status, string> = {
		...Object.fromEntries(Object.entries(feedStates).map(([k, v]) => [k, v.state])),
		off: 'not set up'
	} as Record<Status, string>;

	onMount(() => {
		ksnWs = new KSNWebSocketController('ksnWs');
		// settings saved before this option existed don't have it; it defaults to on
		if (settings.current.followConsoleStageMap === undefined) {
			settings.current.followConsoleStageMap = true;
		}
		if (settings.current.followRacePlayers === undefined) {
			settings.current.followRacePlayers = true;
		}
		if (settings.current.selectDuelPlayers === undefined) {
			settings.current.selectDuelPlayers = true;
		}
		if (settings.current.ksnWebSocketToken) {
			live.connect(settings.current.ksnWebSocketToken, consoleBaseUrl());
		}

		importPools();
		loadTournaments();

		if (settings.current.jfRelayWebSocketToken)
			jfRelayWs.connect(settings.current.jfRelayWebSocketToken);

		if (settings.current.obsWsPw) {
			obsConnect(settings.current.obsWsIp, settings.current.obsWsPort, settings.current.obsWsPw);
		}

		// untracked: setScene reads the obs connection's state and connectToJfRelay the settings,
		// which would make these re-run on a reconnect or any settings change
		$effect(() => {
			const scene = overlayScene;
			if (scene) untrack(() => setScene(scene));
		});

		$effect(() => {
			if (rtdEnabled) untrack(connectToJfRelay);
		});

		return () => live.close();
	});

	async function connectToJfRelay() {
		error.invalidJfRelayToken.state = await new Promise<boolean>((res) => {
			jfRelayWs?.connect(settings.current.jfRelayWebSocketToken.trim());
			jfRelayWs?.addEventListener('open', () => res(false));
			jfRelayWs?.addEventListener('error', () => res(true));
		});
	}
</script>

<span class="self-center">jtoo controls</span>

<!-- links -->
<div class="absolute right-4 flex flex-row-reverse gap-1">
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<a
		class="opacity-50 hover:opacity-100"
		href="https://github.com/jump-fortress/jtoo"
		target="_blank"
	>
		<span class="icon-[mdi--github] size-8 text-white"></span>
	</a>
</div>

{#if ksnWs}
	<!-- status bar: every connection at a glance, and a click away from its settings -->
	<nav
		class="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 flex w-[calc(100%+2rem)] flex-col items-center self-center bg-obs-content px-4 py-1"
		aria-label="connections"
	>
		<div class="flex flex-wrap justify-center gap-x-4 gap-y-1">
			{#each statuses as s (s.id)}
				<button
					class="flex items-center gap-1.5 hover:opacity-100
						{openStatus === s.id ? 'underline decoration-ctp-lavender' : 'opacity-80'}"
					title="{s.id}: {statusText[s.status]}{s.detail ? ` (${s.detail})` : ''}"
					aria-expanded={openStatus === s.id}
					aria-controls="status-panel"
					onclick={() => (openStatus = openStatus === s.id ? null : s.id)}
				>
					<span class="size-2.5 rounded-full {statusDots[s.status]}" aria-hidden="true"></span>
					<span>{s.id}</span>
					<span class="sr-only">{statusText[s.status]}</span>
				</button>
			{/each}
		</div>
		{#if openStatus}
			<!-- capped so a tall panel can't push the whole page out from under the bar -->
			<div
				id="status-panel"
				class="mt-1 flex max-h-[60vh] w-full max-w-lg flex-col gap-1 overflow-y-auto border-t-2 border-obs-padding pt-2 pb-1"
				transition:slide
			>
				{#if openStatus === 'obs'}
					<ConnectionPanel
						label="password"
						id="input-websocket-obs-pw"
						bind:value={settings.current.obsWsPw}
						onconnect={() => {
							if (settings.current.obsWsPw) {
								obsConnect(
									settings.current.obsWsIp,
									settings.current.obsWsPort,
									settings.current.obsWsPw
								);
							}
						}}
						state={obsStatus.state}
						error={obsStatus.error}
					>
						{#snippet advanced()}
							<div class="grid grid-cols-[max-content_1fr] items-center gap-x-2 gap-y-1">
								<label for="input-websocket-obs">ip:</label>
								<input
									type="text"
									class="input"
									id="input-websocket-obs"
									placeholder="localhost"
									bind:value={settings.current.obsWsIp}
								/>
								<label for="input-websocket-obs-port">port:</label>
								<input
									type="number"
									class="input remove-arrow"
									id="input-websocket-obs-port"
									placeholder="4455"
									bind:value={settings.current.obsWsPort}
								/>
							</div>
						{/snippet}
					</ConnectionPanel>
				{:else if openStatus === 'console'}
					<ConnectionPanel
						label="token"
						id="input-websocket"
						bind:value={settings.current.ksnWebSocketToken}
						onconnect={connectConsole}
						state={live.raceState}
						note={live.dummy ? 'showing dummy data' : undefined}
					>
						<!-- the pool import shares the console's dot, so its errors show here too -->
						{#if poolImport && poolImport !== 'importing'}
							{#each poolImport.errors as err, i (i)}
								<span class="text-red-300">pool import failed: {err}</span>
							{/each}
						{/if}
						{#snippet advanced()}
							<div class="flex justify-between gap-2">
								{#if poolImport === 'importing'}
									<span class="text-yellow-200">importing console pools...</span>
								{:else if poolImport}
									<span class={poolImport.errors.length ? 'text-red-300' : 'opacity-60'}>
										imported {poolImport.players} players and {poolImport.maps} maps
									</span>
								{:else}
									<span></span>
								{/if}
								<button
									class="button-remove"
									title="import the event's players and maps from the console pools again"
									disabled={poolImport === 'importing'}
									onclick={importPools}>re-import</button
								>
							</div>
							<div class="grid grid-cols-[max-content_1fr] items-center gap-x-2">
								<label for="input-console-url">console url:</label>
								<input
									type="text"
									class="input"
									id="input-console-url"
									placeholder="https://console.jumpfortress.tf"
									value={settings.current.consoleBaseUrl}
									onchange={(e) => {
										let target = e.target as HTMLInputElement;
										settings.current.consoleBaseUrl = target.value.trim();
									}}
								/>
							</div>
							<Checkbox setting="followConsoleStageMap" desc="set stage and map from the console" />
							<Checkbox setting="useDummyData" desc="use dummy race and tournament data" />
							<Checkbox setting="logWsMessages" desc="log websocket messages" />
						{/snippet}
					</ConnectionPanel>
				{:else if openStatus === 'relay'}
					<ConnectionPanel
						label="token"
						id="input-websocket-jf"
						bind:value={settings.current.jfRelayWebSocketToken}
						onconnect={connectToJfRelay}
						state={relayState}
						error={error.invalidJfRelayToken.state ? error.invalidJfRelayToken.msg : undefined}
					/>
				{/if}
			</div>
		{/if}
	</nav>

	<!-- presets -->
	<div class="relative m-2 flex w-full max-w-lg justify-center gap-4 self-center">
		<ConfirmButton
			onconfirm={() => {
				// in console time, so it compares with the race's own timestamps
				overlay.current.timersClearedAt = Date.now() + live.clockOffset;
			}}>clear timers</ConfirmButton
		>
		<ConfirmButton onconfirm={() => ksnWs!.clearPicksAndBans()}
			>clear map picks and bans</ConfirmButton
		>
		<ConfirmButton onconfirm={resetVisualSettings}>reset visual settings</ConfirmButton>
	</div>

	<!-- items -->
	<Accordion title="items">
		<div class="grid w-full grid-cols-2">
			<Importplayer />
			<ManagePlayers />
			<ImportMap />
			<ManageMaps />
			<EditBracket />
			<ManageBrackets />
		</div>
	</Accordion>

	<Accordion title="scenes">
		<span>scene</span>
		<RadioInputs
			opts={OverlayScenes.filter((s) => !BrokenOverlayScenes.includes(s))}
			bind:value={settings.current.overlayScene}
			onpick={(scene) => scene && setScene(scene)}
		/>

		<div class="flex items-center justify-between gap-2">
			<label for="input-idle-obs-scene">idle scene</label>
			<input
				type="text"
				class="input"
				id="input-idle-obs-scene"
				placeholder="Idle"
				title="name of the OBS scene this overlay is shown on, without backgrounds"
				value={settings.current.idleObsScene}
				onchange={(e) => (settings.current.idleObsScene = (e.target as HTMLInputElement).value)}
			/>
		</div>
		<RadioInputs
			opts={IdleOverlayScenes}
			bind:value={settings.current.idleOverlayScene}
			onpick={() => setScene(idleOBSSceneName())}
		/>

		<div class="flex justify-between">
			<span>leaderboard tournament</span>
			<button class="button-remove" onclick={loadTournaments}>refresh</button>
		</div>
		{#if tournamentsError}
			<span class="text-red-300">{tournamentsError}</span>
		{/if}
		<RadioInputs
			opts={['', ...(tournaments?.tournaments.map((t) => t.id) ?? [])]}
			optlabels={[
				'follow active tournament',
				...(tournaments?.tournaments.map(
					(t) => t.name + (t.id === tournaments?.activeTournamentId ? ' (active)' : '')
				) ?? [])
			]}
			bind:value={overlay.current.tournament}
		/>

		<span>leaderboard view</span>
		<RadioInputs
			opts={['standings', ...leaderboardRounds.map((r) => r.roundIndex), 'final']}
			optlabels={[
				'current standings',
				...leaderboardRounds.map((r) => `${r.roundIndex + 1}: ${r.map || r.stage}`),
				'final standings'
			]}
			bind:value={
				() => overlay.current.leaderboardView ?? 'standings',
				(view) => (overlay.current.leaderboardView = view)
			}
		/>

		<span>bracket</span>
		<RadioInputs
			opts={(items.current.brackets ?? []).map((b) => b.id)}
			optlabels={(items.current.brackets ?? []).map((b) => b.name)}
			bind:value={overlay.current.bracket}
		/>

		<span>class</span>
		<RadioInputs
			opts={TFClasses.filter((c) => c !== 'overall')}
			bind:value={settings.current.tfClass}
		/>

		<div class="flex justify-between">
			<span>schedule day</span>
			<button
				class="button-remove"
				title="re-fetch the sheet in the controls and on the overlay"
				disabled={schedule.loading}
				onclick={refreshSchedule}>refresh</button
			>
		</div>
		<RadioInputs
			opts={scheduleDays.map((_, i) => i)}
			optlabels={scheduleDays.map((d) => d.name)}
			bind:value={
				() => settings.current.scheduleDay ?? 0, (day) => (settings.current.scheduleDay = day)
			}
			onchange={() => schedule.load(scheduleSheetUrl())}
		/>
		{#if schedule.loading}
			<span class="opacity-60">loading...</span>
		{:else if schedule.error}
			<span class="text-red-300">{schedule.error}</span>
		{:else if schedule.schedule}
			<span class="opacity-60">
				{schedule.schedule.title} ({schedule.schedule.segments.length} segments)
			</span>
		{/if}
	</Accordion>

	<SetFundraisingEvent />
	<!-- settings -->
	<Accordion title="settings" defaultstate="closed">
		<span>font</span>
		<RadioInputs opts={[...Fonts]} bind:value={settings.current.font} />
		<span>mono font</span>
		<RadioInputs opts={[...MonoFonts]} bind:value={settings.current.monoFont} />

		<!-- color -->
		<span>theme</span>
		<div class="flex gap-2">
			<div
				class="size-12 border-4 border-ctp-text bg-ctp-lavender"
				style:filter={getFiltersStyle()}
			></div>
			<div class="flex flex-col justify-evenly">
				<RangeInput setting="hue" max={360} />
				<RangeInput setting="saturation" max={200} />
			</div>
		</div>

		<hr class="hr" />

		<Checkbox desc="show flags" setting="enableFlags" />
		<Checkbox desc="use moving background" setting="enableMovingBG" />
		<Checkbox desc="use short map names" setting="useShortMapNames" />
		<Checkbox desc="show POV guide" setting="enablePOVGuide" />
		<Checkbox desc="use gradient" setting="enableGradient" />
		{#if settings.current.enableGradient}
			<Checkbox desc="use red & blue team colors" setting="enableTeamColors" />
		{/if}
		<Checkbox desc="use player PRs" setting="enablePRs" />
		<Checkbox desc="use avatars" setting="enableAvatars" />
		<Checkbox desc="use tags" setting="enableTags" />
		<Checkbox desc="show fundraising section" setting="enableFundraisingSection" />
		<Checkbox desc="enable fundraising RTD" setting="enableFundraisingRtd" />
		{#if settings.current.enableFundraisingRtd && error.invalidJfRelayToken.state}
			<div>{error.invalidJfRelayToken.msg}</div>
		{/if}
		<Checkbox desc="iterate fundraising donations" setting="enableFundraisingDonations" />
		<label>
			<input
				type="number"
				min="0"
				class="input remove-arrow w-7 accent-ctp-lavender"
				bind:value={settings.current.fundraisingShowDonationSeconds}
			/>
			<span>seconds to show each donation for</span>
		</label>
		<Checkbox setting="followRacePlayers" desc="filter players to current race" />
		<Checkbox
			setting="selectDuelPlayers"
			desc="automatically select players on 1v1 race and map picks start"
		/>
	</Accordion>

	<!-- overlay -->
	<!-- <div class="relative mb-2 flex w-full max-w-lg justify-center gap-1 self-center">
		<span class="absolute left-0">best of</span>
		<RadioInputs opts={[1, 3, 5, 7, 9]} bind:value={overlay.current.bestOf} log={true} />
	</div> -->

	<!-- players -->
	<div class="flex w-full max-w-lg justify-evenly gap-x-20 self-center">
		<PlayerControl player={overlay.current.players[0]} playerNum={0} />
		<PlayerControl player={overlay.current.players[1]} playerNum={1} />
		<!-- disabled since 4 player POV is not implemented yet -->
		<!-- <hr class="hr" />
		<PlayerControl player={overlay.current.players[2]} playerNum={2} />
		<hr class="hr" />
		<PlayerControl player={overlay.current.players[3]} playerNum={3} /> -->
	</div>

	<div class="max-w-lg self-center">
		<!-- maps -->

		<span>map</span>
		<RadioInputs
			opts={poolMaps()}
			optlabels={settings.current.useShortMapNames
				? poolMaps().map((m) => getMap(m).shortName || m)
				: undefined}
			bind:value={overlay.current.map}
		/>

		<!-- stages -->
		<div class="flex justify-between">
			<span>stage</span>
			<button
				class="button-remove"
				onclick={() => {
					items.current.stages = defaultStages;
				}}>reset to default</button
			>
		</div>
		<ItemInput placeholder="add stage" item="stages" class="pb-2" />
		<RadioInputs opts={[...items.current.stages]} bind:value={overlay.current.stage} />
	</div>
{/if}
