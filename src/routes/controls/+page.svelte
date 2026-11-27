<script lang="ts">
	import Accordion from '$lib/components/controls/Accordion.svelte';
	import Checkbox from '$lib/components/controls/Checkbox.svelte';
	import ConfirmButton from '$lib/components/controls/ConfirmButton.svelte';
	import ControlsNav from '$lib/components/controls/ControlsNav.svelte';
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

	import { obsConnect, setScene } from '$lib/websockets/obs/ws-obs.svelte';
	import { idleOBSSceneName } from '$lib/obs-browser-source.svelte';
	import { importConsolePools, poolMaps, type PoolImportResult } from '$lib/console-pools.svelte';
	import { fetchConsoleTournaments, type ConsoleTournamentList } from '$lib/console-tournaments';

	import { KSNWebSocketController } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import { getMap, consoleBaseUrl, roundNumber } from '$lib/util';
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

	// the map and stage section starts closed, since the console normally sets them, so its title
	// shows what's set and whether the console is setting it
	const mapStageTitle = $derived(
		`map and stage: ${overlay.current.map || 'none'}, ${overlay.current.stage || 'none'}` +
			(settings.current.followConsoleStageMap ? ' (set by console)' : '')
	);

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

	let error = $state({
		invalidJfRelayToken: {
			state: false,
			msg: 'error: invalid jf relay websocket token'
		} as Error
	});

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

		// with rtd on, the effect below connects instead (and checks the token)
		if (settings.current.jfRelayWebSocketToken && !rtdEnabled)
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
		// the mini leaderboard page keeps its own relay connection; reconnect it too
		const channel = new BroadcastChannel('jfRelayWs');
		channel.postMessage({ type: 'connect', value: settings.current.jfRelayWebSocketToken });
		channel.close();
		error.invalidJfRelayToken.state = await new Promise<boolean>((res) => {
			jfRelayWs?.connect(settings.current.jfRelayWebSocketToken.trim());
			jfRelayWs?.addEventListener('open', () => res(false));
			jfRelayWs?.addEventListener('error', () => res(true));
		});
	}
</script>

<ControlsNav
	{poolImport}
	{importPools}
	onconnectconsole={connectConsole}
	onconnectrelay={connectToJfRelay}
	relayError={error.invalidJfRelayToken.state ? error.invalidJfRelayToken.msg : undefined}
/>

{#if ksnWs}
	<!-- presets -->
	<div class="relative m-2 flex w-full max-w-lg justify-center gap-4 self-center">
		<ConfirmButton
			onconfirm={() => {
				// in console time, so it compares with the race's own timestamps
				overlay.current.timersClearedAt = Date.now() + live.clockOffset;
			}}>clear timers</ConfirmButton
		>
		<ConfirmButton
			onconfirm={() => {
				// in console time, like the timers
				overlay.current.miniLeaderboardClearedAt = Date.now() + live.clockOffset;
			}}>clear mini leaderboard</ConfirmButton
		>
		<ConfirmButton onconfirm={() => ksnWs!.clearPicksAndBans()}
			>clear map picks and bans</ConfirmButton
		>
		<ConfirmButton onconfirm={resetVisualSettings}>reset visual settings</ConfirmButton>
	</div>

	<!-- MARK: live
	     what changes during the show, always visible: the OBS scene and players A and B -->
	<section class="flex w-full max-w-lg flex-col gap-1 self-center" aria-label="live controls">
		<span>scene</span>
		<RadioInputs
			opts={OverlayScenes.filter((s) => !BrokenOverlayScenes.includes(s))}
			bind:value={settings.current.overlayScene}
			onpick={(scene) => scene && setScene(scene)}
		/>

		<!-- picking one also switches OBS to the idle scene -->
		<span>idle scene overlay</span>
		<RadioInputs
			opts={IdleOverlayScenes}
			bind:value={settings.current.idleOverlayScene}
			onpick={() => setScene(idleOBSSceneName())}
		/>
	</section>

	<!-- overlay -->
	<!-- <div class="relative mb-2 flex w-full max-w-lg justify-center gap-1 self-center">
		<span class="absolute left-0">best of</span>
		<RadioInputs opts={[1, 3, 5, 7, 9]} bind:value={overlay.current.bestOf} log={true} />
	</div> -->

	<!-- players -->
	<!-- two equal columns, so both lists' rows are the same width -->
	<div class="grid w-full max-w-lg grid-cols-2 gap-x-6 self-center">
		<PlayerControl player={overlay.current.players[0]} playerNum={0} />
		<PlayerControl player={overlay.current.players[1]} playerNum={1} />
		<!-- disabled since 4 player POV is not implemented yet -->
		<!-- <hr class="hr" />
		<PlayerControl player={overlay.current.players[2]} playerNum={2} />
		<hr class="hr" />
		<PlayerControl player={overlay.current.players[3]} playerNum={3} /> -->
	</div>
	<hr class="hr w-full max-w-lg self-center" />

	<!-- MARK: map and stage
	     the console sets these, so they're only here to override it; the title shows what's set -->
	<Accordion title={mapStageTitle} defaultstate="closed">
		<span>map</span>
		<RadioInputs
			opts={poolMaps()}
			optlabels={settings.current.useShortMapNames
				? poolMaps().map((m) => getMap(m).shortName || m)
				: undefined}
			bind:value={overlay.current.map}
		/>

		<div class="flex justify-between">
			<span>stage</span>
			<ConfirmButton onconfirm={() => (items.current.stages = [...defaultStages])}
				>reset to default</ConfirmButton
			>
		</div>
		<ItemInput placeholder="add stage" item="stages" class="pb-2" />
		<RadioInputs opts={[...items.current.stages]} bind:value={overlay.current.stage} />
	</Accordion>

	<!-- MARK: scene content
	     what the scenes show: set up before a segment, rarely changed during one -->
	<Accordion title="scene content" defaultstate="closed">
		<div class="flex items-center justify-between gap-2">
			<label for="input-idle-obs-scene">idle OBS scene name</label>
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
				...leaderboardRounds.map(
					(r) => `${roundNumber(live.tournament?.rounds ?? [], r)}: ${r.map || r.stage}`
				),
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

	<!-- MARK: setup -->
	<Accordion title="items" defaultstate="closed">
		<div class="grid w-full grid-cols-2">
			<Importplayer />
			<ManagePlayers />
			<ImportMap />
			<ManageMaps />
			<EditBracket />
			<ManageBrackets />
		</div>
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
{/if}
