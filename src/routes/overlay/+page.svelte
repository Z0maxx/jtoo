<script lang="ts">
	import { settings } from '$lib/storage.svelte';

	import DualPovMatchScene from '$lib/scenes/DualPovMatchScene.svelte';
	import SinglePovMatchScene from '$lib/scenes/SinglePovMatchScene.svelte';
	import MapScene from '$lib/scenes/MapScene.svelte';
	import BracketScene from '$lib/scenes/BracketScene.svelte';
	import PlayerCardScene from '$lib/scenes/PlayerCardScene.svelte';
	import PlayerListScene from '$lib/scenes/PlayerListScene.svelte';
	import ThanksScene from '$lib/scenes/ThanksScene.svelte';
	import TournamentInfoScene from '$lib/scenes/TournamentInfoScene.svelte';
	import { OverlayScenes, type OverlayScene } from '$lib/types.svelte';

	import { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import { consoleBaseUrl } from '$lib/util';
	import { onDestroy, onMount, setContext, type Component } from 'svelte';
	import LeaderboardScene from '$lib/scenes/LeaderboardScene.svelte';

	let ksnWs: KSNWebSocket | undefined = $state();

	// race and tournament state comes from the console's live feeds
	const live = new ConsoleLive({ tournament: true });
	setContext('consoleLive', live);

	onMount(() => {
		ksnWs = new KSNWebSocket('ksnWs');
		setContext('ksnWs', ksnWs);

		// the controls' connect button reconnects both the raw websocket and the feeds
		ksnWs.onconnect = (token) => live.connect(token, consoleBaseUrl());

		if (settings.current.ksnWebSocketToken) {
			ksnWs.connect(settings.current.ksnWebSocketToken);
		}
	});
	onDestroy(() => live.close());

	let sceneComponents: Record<Exclude<OverlayScene, ''>, Component> = {
		DualPovMatchScene,
		SinglePovMatchScene,
		MapScene,
		BracketScene,
		PlayerCardScene,
		PlayerListScene,
		ThanksScene,
		LeaderboardScene,
		TournamentInfoScene
	};

	let page = $derived(settings.current.overlayScene);
</script>

{#if ksnWs}
	{#each OverlayScenes as scene, i (i)}
		{#if scene && page == scene}
			{@const SvelteComponent = sceneComponents[scene]}
			<SvelteComponent />
		{/if}
	{/each}
{/if}
