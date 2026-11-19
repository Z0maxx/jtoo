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

  const store = fundraisingState.current
  store.animationStage = 0
  store.progressBar.raised = 0
  store.progressBar.sumRaised = 0
	const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
	let advancingProgressBar = false;
	let overview: DonationsOverview = $state({
		goal: 0,
		raised: 0,
		donationCount: 0
	});

	const overviewSubId = Dwb.subscribeToDonationsOverview((newOverview) => {
		overview = newOverview;
    if (store.sumGoal === 0) {
      store.sumGoal = overview.goal
    }

		advanceProgressBar();
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
	});

	let goalPercentage = $derived(() => {
		return (store.progressBar.raised / currentGoal()) * 100;
	});

  let currentGoal = $derived(() => {
		return store.stage === 0 ? overview.goal : 1000
	})

	async function advanceProgressBar() {
		if (advancingProgressBar) return;

		advancingProgressBar = true;
    //while (store.progressBar.sumRaised < overview.raised) {
		while (store.progressBar.raised < overview.raised * 1.5) {
      store.progressBar.sumRaised++
			store.progressBar.raised++;
			if (goalPercentage() === 100) {
				const explosionLeft = document.getElementById('explosion-left')! as HTMLImageElement;
				const explosionRight = document.getElementById('explosion-right')! as HTMLImageElement;
				explosionLeft.src = emptyImage;
				explosionRight.src = emptyImage;
				if (store.stage % 2 === 0) {
					explosionRight.src = explosion;
				} else {
					explosionLeft.src = explosion;
				}

        store.stage++
        store.sumGoal += currentGoal()
				store.animationStage = store.stage;
        setTimeout(() => {
          store.animationStage = 0
        }, 10 * 1000)

				store.progressBar.raised = 0;
			}

			await sleep(10);
		}

		advancingProgressBar = false;
	}
</script>

<div
	class="relative z-10 origin-bottom-left duration-700 ease-[cubic-bezier(.81,-0.73,.83,.67)]
  {store.animationStage === 3 ? 'rotate-31' : ''}"
>
	<div class="flex justify-between text-3xl">
		<span
			class="origin-bottom-right duration-500 ease-in {store.animationStage === 6
				? 'translate-x-[1em] translate-y-[-1em] rotate-180'
				: ''}">${overview.raised} Raised</span
		>
		<span>{overview.donationCount} Donations</span>
		<span class="duration-300 {store.animationStage === 5 ? 'rotate-y-180' : ''}"
			>${store.sumGoal} Goal</span
		>
	</div>
	<div class="relative h-6 w-full">
		<div
			class="h-full w-full overflow-hidden rounded-md bg-gray-400
      {store.stage % 2 === 1 ? 'rotate-y-180' : ''}"
		>
			<div
				style="width: {goalPercentage() % 100}%; background-image: url('{smoke}')"
				class="bg-size-cover relative h-full overflow-hidden bg-size-[auto_100%] bg-repeat-x"
			>
				<div class="absolute right-0 aspect-[16/9] h-full bg-gray-400">
					<div class="relative h-full w-full">
						<img
							src={rocketProjectile}
							alt="rocket-projectile"
							class="absolute top-[50%] right-0 h-1/2 translate-y-[-50%]"
						/>
						<img src={rocketSparks} alt="rocket-trail" class="absolute -left-[20%] h-full" />
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
