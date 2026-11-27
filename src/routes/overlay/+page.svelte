<script lang="ts">
	import { overlay, settings } from '$lib/storage.svelte';

	import MatchScene from '$lib/scenes/MatchScene.svelte';
	import MapScene from '$lib/scenes/MapScene.svelte';
	import BracketScene from '$lib/scenes/BracketScene.svelte';
	import PlayerCardScene from '$lib/scenes/PlayerCardScene.svelte';
	import PlayerListScene from '$lib/scenes/PlayerListScene.svelte';
	import ThanksScene from '$lib/scenes/ThanksScene.svelte';
	import TournamentInfoScene from '$lib/scenes/TournamentInfoScene.svelte';
	import ScheduleScene from '$lib/scenes/ScheduleScene.svelte';
	import DonationsScene from '$lib/scenes/DonationsScene.svelte';
	import { OverlayScenes, type OverlayScene } from '$lib/types.svelte';

	import { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import { JFRelayWebSocket } from '$lib/websockets/jf-relay/js-relay.svelte';
	import { syncWithRace } from '$lib/websockets/console/race-sync.svelte';
	import { consoleBaseUrl } from '$lib/util';
	import { onDestroy, onMount, setContext, type Component } from 'svelte';
	import LeaderboardScene from '$lib/scenes/LeaderboardScene.svelte';
	import { onIdleScene, watchOBSScene } from '$lib/obs-browser-source.svelte';
	import { pollSchedule } from '$lib/schedule.svelte';
	import { preloadImages } from '$lib/image-preload.svelte';

	let ksnWs: KSNWebSocket | undefined = $state();

	// race and tournament state comes from the console's live feeds
	const live = new ConsoleLive({ tournament: true });
	setContext('consoleLive', live);

	// the relay's map progress orders the match scenes' mini leaderboard during mass-single races
	const jfRelayWs = new JFRelayWebSocket();
	setContext('jfRelayWs', jfRelayWs);

	// add the race's players and map to JTOO when it doesn't know them, and select a duel's racers
	syncWithRace(live, () => ksnWs?.messages.mapPicks?.session);

	// the leaderboard scene shows the tournament picked in the controls, or the race's own
	$effect(() => {
		live.pinTournament(overlay.current.tournament || null);
	});

	// keep the schedule loaded even off its scene, so switching to it shows it at once
	pollSchedule();

	// load map images, then player avatars, ahead of the scenes that show them
	preloadImages();

	onMount(() => {
		// follow OBS's program scene, to swap to the idle overlay scene on the Idle scene
		watchOBSScene();

		ksnWs = new KSNWebSocket('ksnWs');
		setContext('ksnWs', ksnWs);

		// the controls' connect button reconnects both the raw websocket and the feeds
		ksnWs.onconnect = (token) => live.connect(token, consoleBaseUrl());

		if (settings.current.ksnWebSocketToken) {
			ksnWs.connect(settings.current.ksnWebSocketToken);
		}

		if (settings.current.jfRelayWebSocketToken) {
			jfRelayWs.connect(settings.current.jfRelayWebSocketToken);
		}
		// the controls' relay connect button reconnects this one too
		const relayChannel = new BroadcastChannel('jfRelayWs');
		relayChannel.onmessage = (event: MessageEvent<{ type: string; value: string }>) => {
			if (event.data.type === 'connect') jfRelayWs.connect(event.data.value);
		};
		return () => relayChannel.close();
	});
	onDestroy(() => {
		live.close();
		jfRelayWs.close();
	});

	// both match scenes are one component, so it stays mounted when switching between them
	type MatchSceneName = 'DualPovMatchScene' | 'SinglePovMatchScene';
	const isMatchScene = (scene: OverlayScene): scene is MatchSceneName =>
		scene === 'DualPovMatchScene' || scene === 'SinglePovMatchScene';

	let sceneComponents: Record<Exclude<OverlayScene, '' | MatchSceneName>, Component> = {
		MapScene,
		BracketScene,
		PlayerCardScene,
		PlayerListScene,
		ThanksScene,
		LeaderboardScene,
		ScheduleScene,
		DonationsScene,
		TournamentInfoScene
	};

	let page: OverlayScene = $derived(
		onIdleScene() ? (settings.current.idleOverlayScene ?? '') : settings.current.overlayScene
	);
</script>

{#if ksnWs}
	{#if isMatchScene(page)}
		<MatchScene single={page === 'SinglePovMatchScene'} />
	{/if}
	{#each OverlayScenes as scene, i (i)}
		{#if scene && page == scene && !isMatchScene(scene)}
			{@const SvelteComponent = sceneComponents[scene]}
			<SvelteComponent />
		{/if}
	{/each}
{/if}
