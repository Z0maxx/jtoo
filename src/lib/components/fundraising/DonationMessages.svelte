<script lang="ts">
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { untrack } from 'svelte';

	let replaced: string | null = $state(null);
	let donations: Donation[] = $state([
		{ id: '', name: '', amount: 0 },
		{ id: '', name: '', amount: 0 }
	]);

	let switchIdx = 0;
	let iteratingDonations = false;
	let setDonationsOnce = false;

	$effect(() => {
		const donationsWithMessages =
			fundraisingState.current.displayedDonations /*.filter(d => !!d.message)*/
				.toReversed();
		if (iteratingDonations) return;

		iteratingDonations = true;
		iterateDonations(donationsWithMessages);
	});

	async function iterateDonations(donationsWithMessages: Donation[]) {
		let untrackedDonations = untrack(() => donations);
		if (
			donationsWithMessages.length === 0 ||
			(fundraisingState.current.lastDisplayedDonationWithMessageId ===
				donationsWithMessages.at(-1)!.id &&
				setDonationsOnce)
		) {
			iteratingDonations = false;
			return;
		}

		setDonationsOnce = true;
		const idx = donationsWithMessages.findIndex(
			(d) => d.id === fundraisingState.current.lastDisplayedDonationWithMessageId
		);
		let i = idx > -1 ? idx + 1 : 0;
		while (i < donationsWithMessages.length) {
			const d = donationsWithMessages[i];
			const lastEmpty = untrackedDonations.findIndex((d) => d.id === '');
			if (lastEmpty > -1) {
				untrackedDonations[lastEmpty] = d;
			} else {
				replaced = untrackedDonations[switchIdx].id;
				await sleep(300);
				replaced = '';
				donations[switchIdx] = d;
				switchIdx = 1 - switchIdx;
			}

			fundraisingState.current.lastDisplayedDonationWithMessageId = d.id;
			i++;
		}

		if (untrackedDonations[1].id === '') {
			donationsWithMessages.slice(-2).forEach((d, j) => (untrackedDonations[j] = d));
		} else {
			untrackedDonations[1 - switchIdx] = donationsWithMessages.at(-1)!;
			untrackedDonations[switchIdx] = donationsWithMessages.at(-2)!;
		}

		iteratingDonations = false;
	}
</script>

<div
	class="z-50 flex items-center gap-2 px-2 transition-all duration-400
    {donations.length < 1 ? 'hidden' : ''}"
>
	{#each donations as donation}
		<div
			class="flex flex-col items-center rounded-md border-2 bg-bordeaux px-2 py-1 transition-colors w-120 h-90
        {donation.id === replaced ? 'text-transparent' : ''}"
		>
			{#if donation.id !== ''}
				<div class="flex items-center gap-1 text-xl">
					{#if donation.avatarUrl}
						<img src={donation.avatarUrl} alt="avatar" class="size-6 rounded-full" />
					{/if}
					<span>{donation.name}</span>
				</div>
				<div>${donation.amount}</div>
				<div class="overflow-hidden truncate max-w-full text-wrap">
					{donation.message ??
						'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatis vitae, justo. Nullam dictum felis eu pede mollis pretium. Integer tincidunt. Cras dapibu'
            /*Array.from({ length: 500 }).map(() => 'W').join('')*/}
				</div>
			{/if}
		</div>
	{/each}
</div>
