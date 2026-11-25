<script lang="ts">
	import grain from '$lib/assets/grain.gif';
	import grid from '$lib/assets/grid.png';
	import { fade } from 'svelte/transition';
</script>

<!-- covers the whole overlay as decoration only, so clicks pass through to the scene below -->
<!-- grid mask -->
<div
	transition:fade={{ duration: 500 }}
	class="pointer-events-none absolute size-full animate-[movingMaskBG_20s_linear_infinite] opacity-100"
	style:mask-image="url({grid})"
>
	<!-- grain -->
	<div class="absolute size-full opacity-5" style:background-image="url({grain})"></div>
</div>
