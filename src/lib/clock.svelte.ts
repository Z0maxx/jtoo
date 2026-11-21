import { createSubscriber } from 'svelte/reactivity';

// One requestAnimationFrame loop shared by every timer on the page. It only runs while
// something reactive reads now(), and stops when the last reader goes away.
let current = Date.now();

const subscribe = createSubscriber((update) => {
	let frame = requestAnimationFrame(function tick() {
		current = Date.now();
		update();
		frame = requestAnimationFrame(tick);
	});

	return () => cancelAnimationFrame(frame);
});

/** The local time in epoch ms, updated every animation frame while it's being read. */
export function now(): number {
	subscribe();
	return current;
}
