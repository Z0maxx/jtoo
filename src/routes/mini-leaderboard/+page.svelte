<script lang="ts">
	import MiniLeaderboard from '$lib/components/match/MiniLeaderboard.svelte';
	import { settings } from '$lib/storage.svelte';
	import { consoleBaseUrl } from '$lib/util';
	import { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { KSNBCMessageType } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { onMount, setContext } from 'svelte';

	// this page opens its own race feed, so it works without /overlay being open
	const live = new ConsoleLive();
	setContext('consoleLive', live);

	onMount(() => {
		if (settings.current.ksnWebSocketToken) {
			live.connect(settings.current.ksnWebSocketToken, consoleBaseUrl());
		}

		// reconnect when the controls' connect button is pressed
		const channel = new BroadcastChannel('ksnWs');
		channel.onmessage = (event: MessageEvent<KSNBCMessageType>) => {
			if (event.data.type === 'connect') live.connect(event.data.value, consoleBaseUrl());
		};

		return () => {
			channel.close();
			live.close();
		};
	});
</script>

<MiniLeaderboard />
