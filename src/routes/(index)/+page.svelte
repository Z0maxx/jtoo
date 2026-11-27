<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { BrokenOverlayScenes, OverlayScenes } from '$lib/types.svelte';
	import { fade } from 'svelte/transition';

	let copied: Record<string, string> = $state({});
	let baseUrl = page.url.origin + '/';
	let scenes = OverlayScenes.filter((s) => s && !BrokenOverlayScenes.includes(s));
</script>

<main class="mt-20 mb-20 flex flex-col items-center gap-10 self-center">
	<div>
		<h1 class="text-center text-8xl">JTOO (Jump Tournament OBS Overlay)</h1>
	</div>
	<div>
		<h2 class="mb-2 text-center text-3xl">Docks</h2>
		<hr class="hr" />
		<ul class="mb-5 list-decimal italic">
			<li>in OBS, navigate to Docks -> Custom Browser Docks</li>
			<li>add controls url</li>
		</ul>
		{@render URLButton('controls', 'controls')}
	</div>
	<div>
		<h2 class="mb-2 text-center text-3xl">Overlays</h2>
		<hr class="hr" />
		<ul class="m-auto mb-5 w-fit list-decimal italic">
			<li>in OBS, navigate to Sources -> Add Source -> Browser</li>
			<li>add overlay url</li>
			<li>set width to 1920 and height to 1080</li>
			<li>remove Custom CSS</li>
		</ul>
		{@render URLButton('overlay', 'overlay')}
	</div>
	<div>
		<h2 class="mb-2 text-center text-3xl">Scenes</h2>
		<hr class="hr" />
		<ul class="m-auto mb-5 w-fit list-decimal italic">
			<li>in OBS, add a scene for each of the following</li>
			<div>
				{#each scenes as scene (scene)}
					<div class="ml-4 opacity-80">{scene}</div>
				{/each}
			</div>
			<li>in OBS, navigate to Tools -> WebSocket Server Settings -> Show Connect Info</li>

			<li>
				on the jtoo controls page under connections -> obs websocket, enter your websocket connect
				info
			</li>
			<li>selecting a scene in jtoo will now also select the scene of the same name in OBS</li>
		</ul>
	</div>
	<div>
		<h2 class="mb-2 text-center text-3xl">Live Timer Data</h2>
		<hr class="hr" />
		<ul class="m-auto mb-5 w-fit list-decimal italic">
			<li>timers, checkpoints, and progress come from the ksn (jf) server websocket</li>
			<li>
				you can also sync your ingame observers using the <a
					class="underline opacity-80"
					href="https://github.com/jump-fortress/jf-relay-plugin">jf relay plugin</a
				> websocket
			</li>
			<li>
				tokens aren't public, DM mmarc (@itsmmarc) or Kingstripes (@kingstripes) on discord to
				request them
			</li>
			<li>
				on the jtoo controls page under connections, enter your token in ksn server websocket and/or
				jf relay plugin websocket
			</li>
		</ul>
	</div>
</main>

{#snippet URLButton(name: string, pageUrl: 'controls' | 'overlay', nobg?: boolean)}
	<div class="relative flex flex-col items-center gap-2">
		<a href={resolve(`/${pageUrl}`)}>
			<button
				class="button border-ctp-lavender-950/50 bg-ctp-lavender/35 p-1 px-5 text-4xl hover:bg-ctp-lavender/85"
			>
				{name}
			</button>
		</a>
		<button
			class="button-remove p-1 px-5 text-2xl"
			onmousedown={(e) => {
				let url = e.currentTarget.innerText;
				navigator.clipboard.writeText(url);
				copied[name] = url;
			}}
			onmouseup={() => {
				copied[name] = '';
			}}
		>
			{baseUrl}{pageUrl}
		</button>
		{#if nobg}
			<button
				class="button-remove p-1 px-5 text-2xl"
				onmousedown={(e) => {
					let url = e.currentTarget.innerText;
					navigator.clipboard.writeText(url);
					copied[name] = url;
				}}
				onmouseup={() => {
					copied[name] = '';
				}}
			>
				{baseUrl}{pageUrl + '?nobg'}
			</button>
		{/if}
		{#if copied[name]}
			<div class="absolute -bottom-5" out:fade={{ duration: 3000 }}>copied url to clipboard</div>
		{/if}
	</div>
{/snippet}
