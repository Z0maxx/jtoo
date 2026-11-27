import { items } from './storage.svelte';

// Map images and player avatars are loaded and decoded ahead of time, so a scene that shows
// them has them ready the moment it's switched to. Map images go first: a map image queued
// while avatars are still waiting jumps ahead of them.

const CONCURRENCY = 4;

// the decoded images are kept referenced so the browser keeps them in its memory cache
const loaded = new Map<string, HTMLImageElement>();
const queued = new Set<string>();
const mapQueue: string[] = [];
const avatarQueue: string[] = [];
let active = 0;

function enqueue(urls: (string | undefined)[], queue: string[]) {
	for (const url of urls) {
		if (!url || loaded.has(url) || queued.has(url)) continue;
		queued.add(url);
		queue.push(url);
	}
	pump();
}

function pump() {
	while (active < CONCURRENCY) {
		const url = mapQueue.shift() ?? avatarQueue.shift();
		if (!url) return;
		active++;
		load(url).finally(() => {
			active--;
			queued.delete(url);
			pump();
		});
	}
}

async function load(url: string) {
	const img = new Image();
	img.decoding = 'async';
	img.src = url;
	try {
		await img.decode();
		loaded.set(url, img);
	} catch {
		// a broken or blocked image; the scene shows its own fallback
	}
}

/** Keeps every map image, then every player avatar, JTOO has loaded. Call from a component. */
export function preloadImages() {
	$effect(() => {
		enqueue(
			items.current.maps.map((m) => m.imageURL),
			mapQueue
		);
		enqueue(
			items.current.players.map((p) => p.avatarURL),
			avatarQueue
		);
	});
}
