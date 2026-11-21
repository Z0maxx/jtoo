import { createSubscriber } from 'svelte/reactivity';

// One requestAnimationFrame loop shared by every timer on the page. It only runs while
// something reactive reads now(), and stops when the last reader goes away.
const subscribe = createSubscriber((update) => {
	let frame = requestAnimationFrame(function tick() {
		update();
		frame = requestAnimationFrame(tick);
	});

	return () => cancelAnimationFrame(frame);
});

/**
 * The local time in epoch ms. Reactive readers re-run every animation frame. The time is
 * read fresh on every call, so it's still right when frames are paused (a hidden tab) and
 * something else, like a new snapshot, triggers the update.
 */
export function now(): number {
	subscribe();
	return Date.now();
}
