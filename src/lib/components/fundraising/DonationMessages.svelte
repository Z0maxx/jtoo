<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { onDestroy, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	// two donation cards side by side, filling the size the scene gives them: the top donation
	// on the left, the latest on the right (highlighted for a while when it comes in, then
	// joined by the ones before it). compact cards (when the scene is short on room) show just
	// the name and amount, and only the latest donation on the right
	type Props = { class?: string; compact?: boolean };
	let { class: styleClass = '', compact = false }: Props = $props();

	const HIGHLIGHT_MS = 10 * 1000;
	const RECENT_AFTER_MS = 30 * 1000;

	let donations: Donation[] = $state([]);
	let processing = false;
	let destroyed = false;

	// the latest donation card steps through new donations one at a time, so the cursor is the
	// donation it's showing. it's saved, so a reloaded overlay doesn't replay old donations
	const cursor = () => fundraisingState.current.lastDonationProcessedByMessagesId;
	let shownCount = $derived(donations.findIndex((d) => d.id === cursor()) + 1);
	let latest = $derived(shownCount > 0 ? donations[shownCount - 1] : undefined);
	// the biggest donation shown so far (the earliest on a tie), so it doesn't jump ahead of the
	// latest card while that's still stepping through a batch
	let top = $derived(
		donations
			.slice(0, shownCount)
			.reduce<Donation | undefined>(
				(best, d) => (!best || d.amount > best.amount ? d : best),
				undefined
			)
	);

	let highlightedId = $state('');
	let highlightTimeout: ReturnType<typeof setTimeout> | undefined;
	let highlighted = $derived(!!latest && latest.id === highlightedId);

	// a new donation has the right card to itself for a while, then the card shows the latest
	// few stacked (latest first), as many as fit. a (re)loaded overlay has nothing new, so it
	// starts stacked
	const MAX_RECENT = 4;
	let showRecent = $state(true);
	let recentTimeout: ReturnType<typeof setTimeout> | undefined;
	let recent = $derived(
		showRecent ? donations.slice(Math.max(0, shownCount - MAX_RECENT), shownCount).reverse() : []
	);

	const iterateDonations = () => settings.current.enableFundraisingDonations;

	const donationsSubId = Dwb.subscribeToDonations((d) => {
		donations = d;
		// a new event (or a cursor that's gone): start at the latest donation instead of
		// replaying the whole event
		if (d.length > 0 && !d.some((x) => x.id === cursor())) {
			fundraisingState.current.lastDonationProcessedByMessagesId = d.at(-1)!.id;
		}
		processNewDonations();
	});

	onDestroy(() => {
		destroyed = true;
		clearTimeout(highlightTimeout);
		clearTimeout(recentTimeout);
		Dwb.unsubscribeFromDonations(donationsSubId);
	});

	async function processNewDonations() {
		if (processing) return;

		processing = true;
		let pending = unprocessed();
		while (pending.length > 0) {
			if (destroyed) return;
			if (!iterateDonations()) {
				await sleep(2 * 1000);
				pending = unprocessed();
				continue;
			}

			const d = pending[0];
			fundraisingState.current.lastDonationProcessedByMessagesId = d.id;
			highlight(d.id);

			// give this one its time before a next one (waiting or arriving meanwhile) replaces it
			await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
			pending = unprocessed();
		}

		processing = false;
	}

	function highlight(id: string) {
		highlightedId = id;
		clearTimeout(highlightTimeout);
		highlightTimeout = setTimeout(() => (highlightedId = ''), HIGHLIGHT_MS);

		showRecent = false;
		clearTimeout(recentTimeout);
		recentTimeout = setTimeout(() => (showRecent = true), RECENT_AFTER_MS);
	}

	function unprocessed(): Donation[] {
		const idx = donations.findIndex((d) => d.id === cursor());
		return donations.slice(idx + 1);
	}
</script>

<!-- a donation's name, amount and message (not in compact cards) -->
{#snippet entry(donation: Donation, peach: boolean, lines: string)}
	<div class="flex items-center gap-2.5">
		<span class="truncate text-[21px] font-bold" style:filter={getFiltersStyle()}
			>{donation.name || 'Anonymous'}</span
		>
		<span
			class="ml-auto text-[21px] transition-colors duration-500
			{peach ? 'text-ctp-peach' : 'text-ctp-lavender'} {settings.current.monoFont}"
			style:filter={getFiltersStyle()}
		>
			${donation.amount.toLocaleString('en-US')}
		</span>
	</div>
	{#if donation.message && !compact}
		<p class="m-0 {lines} text-lg leading-snug text-ctp-subtext1" style:filter={getFiltersStyle()}>
			{donation.message}
		</p>
	{/if}
{/snippet}

<!-- a card's background and heading, with its content crossfading whenever key changes -->
{#snippet card(key: string, header: string, peach: boolean, content: Snippet)}
	<div class="relative isolate min-h-0">
		<div
			class="absolute inset-0 -z-1 rounded-[10px] ring-1 transition-colors duration-500 ring-inset
			{peach ? 'bg-[#1d1410]/92 ring-ctp-peach/70' : 'bg-[#0f0f16]/92 ring-ctp-lavender/35'}"
			style:filter={getFiltersStyle()}
		></div>
		{#key key}
			<!-- absolute, so the outgoing and incoming content overlap as they fade -->
			<div
				class="absolute inset-0 flex flex-col gap-2 overflow-hidden px-4.5 py-3.5"
				transition:fade={{ duration: 400 }}
			>
				<span
					class="text-sm font-bold tracking-wider uppercase transition-colors duration-500
					{peach ? 'text-ctp-peach' : 'text-ctp-overlay2'}"
					style:filter={getFiltersStyle()}>{header}</span
				>
				{@render content()}
			</div>
		{/key}
	</div>
{/snippet}

<div class="{styleClass} grid grid-cols-2 gap-3.5">
	{#if top}
		{#snippet topContent()}
			{@render entry(top!, false, 'line-clamp-2')}
		{/snippet}
		{@render card(top.id, 'Top Donation', false, topContent)}
	{:else}
		<div></div>
	{/if}

	{#if latest}
		<!-- one card for both views, so switching between them crossfades. a compact card only
		     has room for one donation -->
		{@const stacked = recent.length > 1 && !compact}
		{#snippet rightContent()}
			{#if stacked}
				<!-- a line of message each. the column wraps, so whichever don't fit fully move into
				     a second column outside the card and are clipped: as many show as fit -->
				<div class="flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden">
					{#each recent as d, i (d.id)}
						<div class="relative flex w-full shrink-0 flex-col gap-0.5 {i > 0 ? 'pt-2' : ''}">
							{#if i > 0}
								<div
									class="absolute inset-x-0 top-1 h-px bg-ctp-lavender/20"
									style:filter={getFiltersStyle()}
								></div>
							{/if}
							{@render entry(d, false, 'line-clamp-1')}
						</div>
					{/each}
				</div>
			{:else}
				{@render entry(latest!, highlighted, 'line-clamp-2')}
			{/if}
		{/snippet}
		{@render card(
			stacked ? `recent-${latest.id}` : latest.id,
			stacked ? 'Recent Donations' : 'Latest Donation',
			highlighted && !stacked,
			rightContent
		)}
	{/if}
</div>
