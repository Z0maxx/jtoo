<script lang="ts">
	import MiniLeaderboard from '$lib/components/match/MiniLeaderboard.svelte';
	import { settings } from '$lib/storage.svelte';
	import { consoleBaseUrl } from '$lib/util';
	import { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import { JFRelayWebSocket } from '$lib/websockets/jf-relay/js-relay.svelte';
	import type { KSNBCMessageType } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { onMount, setContext } from 'svelte';

	// this page opens its own race feed, so it works without /overlay being open
	const live = new ConsoleLive();
	setContext('consoleLive', live);
	// and its own relay connection, for the map progress that orders mass-single races
	const jfRelayWs = new JFRelayWebSocket();
	setContext('jfRelayWs', jfRelayWs);

	onMount(() => {
		if (settings.current.ksnWebSocketToken) {
			live.connect(settings.current.ksnWebSocketToken, consoleBaseUrl());
		}

		if (settings.current.jfRelayWebSocketToken) {
			jfRelayWs.connect(settings.current.jfRelayWebSocketToken);
		}

		// reconnect when the controls' connect buttons are pressed
		const channel = new BroadcastChannel('ksnWs');
		channel.onmessage = (event: MessageEvent<KSNBCMessageType>) => {
			if (event.data.type === 'connect') live.connect(event.data.value, consoleBaseUrl());
		};
		const relayChannel = new BroadcastChannel('jfRelayWs');
		relayChannel.onmessage = (event: MessageEvent<{ type: string; value: string }>) => {
			if (event.data.type === 'connect') jfRelayWs.connect(event.data.value);
		};

		return () => {
			channel.close();
			relayChannel.close();
			jfRelayWs.close();
			live.close();
		};
	});
</script>

<MiniLeaderboard />
