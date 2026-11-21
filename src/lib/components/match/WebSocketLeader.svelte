<script lang="ts">
	import { settings } from '$lib/storage.svelte';
	import { getPlayer, msToFormattedTime, playerLabel } from '$lib/util';
	import { fade } from 'svelte/transition';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';

	let live: ConsoleLive = getContext('consoleLive');

	type Props = { class?: string };
	let { class: styleClass }: Props = $props();

	const maxNameLength = 12;
</script>

<div class="{styleClass} absolute right-0 left-0 m-auto mt-2 w-fit {settings.current.font}">
	{#if live.leader}
		{@const leader = live.leader}
		{@const player = getPlayer(leader.steamId3)}
		<div class="text-center text-xl opacity-70">leader</div>
		<div class="flex items-center gap-4 text-3xl">
			{#if player.avatarURL}
				<div>
					<img
						in:fade
						src={player.avatarURL}
						alt=""
						class="size-13 rounded-xl object-cover object-center"
						draggable="false"
					/>
				</div>
			{/if}
			<div>
				{playerLabel(leader.steamId3, maxNameLength)}
			</div>
			<div class={settings.current.monoFont}>
				{leader.prMs !== null ? msToFormattedTime(leader.prMs) : ''}
			</div>
		</div>
	{/if}
</div>
