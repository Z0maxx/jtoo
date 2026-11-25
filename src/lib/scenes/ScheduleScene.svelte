<script lang="ts">
	import SceneTint from '$lib/components/SceneTint.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { currentSegmentIndex, pollSchedule, schedule } from '$lib/schedule.svelte';
	import { settings } from '$lib/storage.svelte';
	import { fade } from 'svelte/transition';
	import jfLogo from '$lib/assets/jf-logo.png';
	import { fitText } from '$lib/fit-text';

	const STREAM_URL = 'twitch.tv/jumpfortress';

	pollSchedule();

	// the on-air segment only changes by the minute, so a coarse clock is plenty
	let time = $state(Date.now());
	$effect(() => {
		const interval = setInterval(() => (time = Date.now()), 10_000);
		return () => clearInterval(interval);
	});

	let segments = $derived(schedule.schedule?.segments ?? []);
	let current = $derived(currentSegmentIndex(segments, time));

	// the sheet's title reads 'EVENT — DAY N: NAME — DATE'
	let titleParts = $derived(
		(schedule.schedule?.title ?? '')
			.split(/\s*—\s*/)
			.map((p) => p.trim())
			.filter(Boolean)
	);
	let eventName = $derived(titleParts[0] ?? '');
	let dayLine = $derived(titleParts.slice(1).map(shortenTitlePart).join(' · '));

	// 'DAY 1: SOLDIER ROYALE' -> 'DAY 1 · SOLDIER ROYALE', '27th of November' -> '27 Nov'
	function shortenTitlePart(part: string): string {
		return part
			.replace(/\s*:\s*/g, ' · ')
			.replace(
				/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/gi,
				(_, day: string, month: string) =>
					`${day} ${month[0].toUpperCase()}${month.slice(1).toLowerCase()}`
			);
	}

	// '8:30 p.m.' -> '20:30'; falls back to the sheet's text when it can't be read
	function clock(minutes: number | undefined, fallback: string): string {
		if (minutes === undefined) return fallback;
		const m = minutes % (24 * 60);
		return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	}
</script>

<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<section
	class="relative z-20 flex min-h-0 w-full grow flex-col gap-8 px-24 py-14 text-ctp-text {settings
		.current.font}"
>
	<SceneTint class="-z-10" />

	{#if schedule.schedule}
		<header class="flex items-start justify-between gap-12" in:fade>
			<!-- flex-1 gives the column the header's spare width, which the heading shrinks to fit -->
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				{#if eventName}
					<span class="text-2xl tracking-[0.18em] text-ctp-subtext0 uppercase">{eventName}</span>
				{/if}
				<h1
					class="leading-none font-bold tracking-tight text-white uppercase"
					{@attach fitText(112, settings.current.font)}
				>
					Broadcast Schedule
				</h1>
				{#if dayLine}
					<span
						class="text-5xl leading-tight font-bold text-ctp-lavender uppercase"
						style:filter={getFiltersStyle()}
					>
						{dayLine}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 flex-col items-end gap-4">
				<img src={jfLogo} alt="Jump Fortress" class="size-32 object-contain" draggable="false" />
				<div
					class="flex items-center gap-4 border-2 border-ctp-lavender/35 bg-ctp-lavender/10 px-6 py-2"
				>
					<span class="size-4 rounded-full bg-ctp-red"></span>
					<span class="text-4xl font-bold text-white">{STREAM_URL}</span>
				</div>
				<span class="text-xl tracking-[0.12em] text-ctp-subtext0 uppercase">all times CET</span>
			</div>
		</header>

		<ul class="flex flex-col">
			{#each segments as s, i (i)}
				{@const live = i === current}
				{@const next = i === current + 1 && current < segments.length}
				<li
					class="relative flex items-center gap-9 rounded-2xl px-7 py-2 transition-opacity duration-500"
					class:opacity-35={i < current}
				>
					{#if live}
						<div
							class="absolute inset-0 -z-10 rounded-2xl bg-ctp-lavender/20 ring-2 ring-ctp-lavender/70"
							style:filter={getFiltersStyle()}
						></div>
					{/if}
					<span
						class="w-28 shrink-0 text-4xl font-semibold text-ctp-lavender tabular-nums {settings
							.current.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{clock(s.startMinutes, s.start)}
					</span>
					<span class="flex min-w-0 grow items-baseline gap-5">
						<span class="truncate text-4xl leading-tight text-white" class:font-bold={live}>
							{s.segment}
						</span>
					</span>
					{#if live}
						<span
							class="shrink-0 rounded-lg bg-ctp-red px-3.5 py-1 text-2xl font-bold tracking-wider text-ctp-crust"
						>
							LIVE
						</span>
					{:else if next}
						<span
							class="shrink-0 rounded-lg border-2 border-ctp-lavender px-3 py-0.5 text-xl font-bold tracking-wider text-ctp-lavender"
							style:filter={getFiltersStyle()}
						>
							UP NEXT
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else if schedule.error}
		<p class="text-2xl text-ctp-red">schedule: {schedule.error}</p>
	{/if}
</section>
