<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import type { DonationsOverview } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';
	import rocketSparks from '$lib/assets/rocket-sparks.gif';
	import rocketProjectile from '$lib/assets/rocket-projectile.png';
	import smoke from '$lib/assets/smoke.png';
	import explosion from '$lib/assets/explosion.gif';
	import { sleep } from '$lib/util';
	import { fundraisingState } from '$lib/storage.svelte';

	/*fundraisingState.current.progressBar.raised = 0;
	fundraisingState.current.progressBar.sumRaised = 0;
	fundraisingState.current.stage = 0;
	fundraisingState.current.sumGoal = 0;*/
	const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
	let advancingProgressBar = false;
	let overview: DonationsOverview = $state({
		goal: 0,
		raised: 0,
		donationCount: 0
	});

	const overviewSubId = Dwb.subscribeToDonationsOverview((newOverview) => {
		overview = newOverview;
		if (fundraisingState.current.sumGoal === 0) {
			fundraisingState.current.sumGoal = overview.goal;
		}

		advanceProgressBar();
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
	});

	const goalPercentage = $derived(() => {
		return (fundraisingState.current.progressBar.raised / currentGoal()) * 100;
	});

	const currentGoal = $derived(() => {
		return fundraisingState.current.stage === 0 ? overview.goal : 1000;
	});

	const isStageEven = $derived(() => fundraisingState.current.stage % 2 === 0);

	async function advanceProgressBar() {
		if (advancingProgressBar) return;

		advancingProgressBar = true;
		while (fundraisingState.current.progressBar.sumRaised < overview.raised) {
		//while (fundraisingState.current.progressBar.raised < overview.raised * 1.5) {
			fundraisingState.current.progressBar.sumRaised++;
			fundraisingState.current.progressBar.raised++;
			/*fundraisingState.current.progressBar.sumRaised += 4;
			fundraisingState.current.progressBar.raised += 4;*/
			if (goalPercentage() === 100) {
				const explosionLeft = document.getElementById('explosion-left')! as HTMLImageElement;
				const explosionRight = document.getElementById('explosion-right')! as HTMLImageElement;
				explosionLeft.src = emptyImage;
				explosionRight.src = emptyImage;
				if (isStageEven()) {
					explosionRight.src = explosion;
				} else {
					explosionLeft.src = explosion;
				}

				fundraisingState.current.stage++;
        fundraisingState.current.animationStage = fundraisingState.current.stage
				fundraisingState.current.sumGoal += currentGoal();
				fundraisingState.current.progressBar.raised = 0;
			}

			await sleep(10);
			//await sleep(2);
		}

		advancingProgressBar = false;
	}
</script>

<div
	class="relative z-10 origin-bottom-left
    {fundraisingState.current.animationStage === 1 ? 'progress-bar-animation-1' : ''}
    {fundraisingState.current.animationStage === 6 ? 'progress-bar-animation-2' : ''}"
>
	<div class="flex justify-between text-3xl">
		<span
			class="origin-bottom-right
        {fundraisingState.current.animationStage === 2 ? 'raised-animation' : ''}"
			>${overview.raised} Raised</span
		>
		<span>{overview.donationCount} Donations</span>
		<span class={fundraisingState.current.animationStage === 5 ? 'goal-animation' : ''}
			>${fundraisingState.current.sumGoal} Goal</span
		>
	</div>
	<div class="relative h-6 w-full">
		<div
			class="h-full w-full overflow-hidden rounded-md bg-gray-400
        {isStageEven() ? '' : 'rotate-y-180'}"
		>
			<div
				style="width: {goalPercentage() % 100}%; background-image: url('{smoke}')"
				class="bg-size-cover relative h-full overflow-hidden bg-size-[auto_100%] bg-repeat-x"
			>
				<div class="absolute right-0 aspect-[21/9] h-full bg-gray-400">
					<div class="relative h-full w-full">
						<img
							src={rocketProjectile}
							alt="rocket-projectile"
							class="absolute top-[50%] right-0 h-1/2 translate-y-[-50%]"
						/>
						<img src={rocketSparks} alt="rocket-trail" class="absolute -left-[16%] h-full" />
					</div>
				</div>
			</div>
		</div>
		<img
			id="explosion-left"
			class="absolute -top-[125%] left-0 aspect-[1/1] h-[300%] rotate-y-180"
			src={emptyImage}
			alt="explosion"
		/>
		<img
			id="explosion-right"
			class="absolute -top-[125%] right-0 aspect-[1/1] h-[300%]"
			src={emptyImage}
			alt="explosion"
		/>
	</div>
</div>

<style>
	:root {
		--progress-bar-1-1-time: 400ms;
		--progress-bar-2-time: 400ms;
	}

	@keyframes progress-bar-1-1 {
		to {
			rotate: -8deg;
		}
	}

	@keyframes progress-bar-1-2 {
		from {
			rotate: -8deg;
		}

		to {
			rotate: 30.8deg;
		}
	}

	@keyframes progress-bar-restore-1 {
		from {
			rotate: 30.8deg;
		}

		to {
			rotate: 0deg;
		}
	}

	@keyframes progress-bar-2 {
		from {
			transform: translateX(0);
		}

		33% {
			transform: translateX(calc(var(--spacing) * 4));
		}

		66% {
			transform: translateX(0);
		}

		to {
			transform: translateX(calc(var(--spacing) * -4));
		}
	}

	@keyframes progress-bar-restore-2 {
		from {
			transform: translateX(calc(var(--spacing) * -4));
		}

		to {
			transform: translateX(0);
		}
	}

	@keyframes raised {
		from {
			transform: translateY(0);
			rotate: 0deg;
		}

		to {
			transform: translateY(1em);
			rotate: 180deg;
		}
	}

	@keyframes goal {
		from {
			transform: rotateY(0deg);
		}

		to {
			transform: rotateY(180deg);
		}
	}

	.progress-bar-animation-1 {
		animation:
			progress-bar-1-1 var(--progress-bar-1-1-time) ease-out forwards,
			progress-bar-1-2 800ms cubic-bezier(0.55, 1.7, 0, 0.63) var(--progress-bar-1-1-time) forwards,
			progress-bar-restore-1 300ms ease-out var(--restore-animation-after) forwards;
	}

	.progress-bar-animation-2 {
		animation:
			progress-bar-2 var(--progress-bar-2-time) linear forwards,
			progress-bar-restore-2 300ms ease-out var(--restore-animation-after) forwards;
	}

	.raised-animation {
		animation:
			raised 1000ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			raised 300ms ease-out var(--restore-animation-after) reverse forwards;
	}

	.goal-animation {
		animation:
			goal 1000ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			goal 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
