<script lang="ts">
	import { teamBg, type Actor } from '$lib/map-picks';
	import { settings } from '$lib/storage.svelte';

	// a pick & ban player's avatar, or their initial on their team colour without one
	let {
		actor,
		name,
		avatar,
		class: className = ''
	}: { actor: Actor; name: string; avatar?: string | null; class?: string } = $props();
</script>

{#if settings.current.enableAvatars && avatar}
	<img src={avatar} alt="" class="object-cover {className}" draggable="false" />
{:else}
	<span
		class="flex items-center justify-center font-bold text-ctp-crust {teamBg[actor]} {className}"
	>
		{name.slice(0, 1).toUpperCase()}
	</span>
{/if}
