<script lang="ts" module>
	import { cubicOut } from 'svelte/easing';

	// how the bar fills in when it appears, shared so values shown beside it can fill in step
	export const FILL_IN = { duration: 3500, easing: cubicOut };
</script>

<script lang="ts">
	import type { DonationsOverview } from '$lib/types.svelte';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import rocketSparks from '$lib/assets/rocket-sparks.gif';
	import rocketProjectile from '$lib/assets/rocket-projectile.png';
	import smoke from '$lib/assets/smoke.png';
	import explosion from '$lib/assets/explosion.gif';
	import { sleep } from '$lib/util';
	import { fundraisingState } from '$lib/storage.svelte';

	// the rocket bar: fills to the event's goal, then to every further 1000, flipping direction
	// and setting off an explosion each time it fills. its progress lives in fundraisingState,
	// so every scene showing it picks up where the last one left off
	let { overview, class: className = '' }: { overview: DonationsOverview; class?: string } =
		$props();

	const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
	let advancingProgressBar = false;
	let destroyed = false;
	let explosionLeft: HTMLImageElement | undefined = $state();
	let explosionRight: HTMLImageElement | undefined = $state();

	onDestroy(() => (destroyed = true));

	// the bar fills from empty up to its progress each time it appears, eg: on a scene change.
	// it scales what's shown, not the saved progress, so donations keep advancing it meanwhile
	const intro = new Tween(0, FILL_IN);
	onMount(() => {
		intro.target = 1;
	});

	const currentGoal = $derived(fundraisingState.current.stage === 0 ? overview.goal : 1000);
	const goalPercentage = $derived(
		(fundraisingState.current.progressBar.raised / currentGoal) * 100
	);
	const isStageEven = $derived(fundraisingState.current.stage % 2 === 0);

	// runs on new overviews only, not on every step of the loop it starts
	$effect(() => {
		const { goal, raised } = overview;
		untrack(() => {
			if (goal && fundraisingState.current.sumGoal === 0) {
				fundraisingState.current.sumGoal = goal;
			}
			if (raised > fundraisingState.current.progressBar.sumRaised) {
				advanceProgressBar();
			}
		});
	});

	async function advanceProgressBar() {
		if (advancingProgressBar) return;

		advancingProgressBar = true;
		// a remounted bar runs its own loop, carrying on from the saved progress
		while (!destroyed && fundraisingState.current.progressBar.sumRaised < overview.raised) {
			fundraisingState.current.progressBar.sumRaised++;
			fundraisingState.current.progressBar.raised++;
			if (goalPercentage === 100) {
				if (explosionLeft) explosionLeft.src = emptyImage;
				if (explosionRight) explosionRight.src = emptyImage;
				const exploding = isStageEven ? explosionRight : explosionLeft;
				if (exploding) exploding.src = explosion;

				fundraisingState.current.stage++;
				fundraisingState.current.animationStage = fundraisingState.current.stage;
				fundraisingState.current.sumGoal += currentGoal;
				fundraisingState.current.progressBar.raised = 0;
			}

			await sleep(10);
		}

		advancingProgressBar = false;
	}
</script>

<div class="relative h-6 w-full {className}">
	<!-- the track, on its own layer so the theme's filter doesn't recolour the smoke and rocket -->
	<div
		class="absolute inset-0 rounded-md bg-ctp-lavender/20"
		style:filter={getFiltersStyle()}
	></div>
	<div
		class="relative h-full w-full overflow-hidden rounded-md
        {isStageEven ? '' : 'rotate-y-180'}"
	>
		<div
			style="width: {(goalPercentage % 100) * intro.current}%"
			class="flex h-full justify-end overflow-hidden"
		>
			<div
				style="background-image: url('{smoke}')"
				class="h-full min-w-0 grow bg-size-[auto_100%] bg-left bg-repeat-x"
			></div>
			<div class="relative aspect-[21/9] h-full shrink-0">
				<img
					src={rocketProjectile}
					alt="rocket-projectile"
					class="absolute top-[50%] right-0 h-1/2 translate-y-[-50%]"
				/>
				<img src={rocketSparks} alt="rocket-trail" class="absolute -left-[16%] h-full" />
			</div>
		</div>
	</div>
	<img
		bind:this={explosionLeft}
		class="absolute -top-[125%] left-0 aspect-[1/1] h-[300%] rotate-y-180"
		src={emptyImage}
		alt="explosion"
	/>
	<img
		bind:this={explosionRight}
		class="absolute -top-[125%] right-0 aspect-[1/1] h-[300%]"
		src={emptyImage}
		alt="explosion"
	/>
</div>
