<script lang="ts">
	import grain from '$lib/assets/grain.gif';
	import grid from '$lib/assets/grid.png';
	import { fade } from 'svelte/transition';

	// povCutout: leaves the dual pov match scene's povs clear, so the gameplay sources under the
	// overlay in OBS show through untouched
	type Props = { povCutout?: boolean };
	let { povCutout = false }: Props = $props();

	// the povs start under the top bar (128px plus its 4px border) and are two 16:9 views side by
	// side, each half the width, so they're 28.125vw tall
	const povTop = '132px';
	const povBottom = 'calc(132px + 28.125vw)';
	const povMask = `linear-gradient(to bottom, #000 ${povTop}, transparent ${povTop}, transparent ${povBottom}, #000 ${povBottom})`;
</script>

<!-- covers the overlay as decoration only, so clicks pass through to the scene below -->
<div
	transition:fade={{ duration: 500 }}
	class="pointer-events-none absolute size-full"
	style:mask-image={povCutout ? povMask : undefined}
>
	<!-- grid mask -->
	<div
		class="absolute size-full animate-[movingMaskBG_20s_linear_infinite] opacity-100"
		style:mask-image="url({grid})"
	>
		<!-- grain -->
		<div class="absolute size-full opacity-5" style:background-image="url({grain})"></div>
	</div>
</div>
