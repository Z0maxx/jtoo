import { overlay, settings } from './storage.svelte';
import type { SteamID3 } from './types.svelte';

/**
 * The selected players as the overlay's match scenes show them: each switch lands
 * playerSwitchDelayMs after it's picked, as the in-game spectator takes that long to switch.
 * Create it while a component initialises; its timers stop when that component is destroyed.
 */
export class DelayedPlayers {
	players: (SteamID3 | undefined)[] = $state([...overlay.current.players]);

	// the last selection a switch was scheduled for. overlay.current changes on any overlay
	// write, not only the players, so unchanged selections are skipped rather than rescheduled
	private scheduled = JSON.stringify(overlay.current.players);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	private timers = new Set<ReturnType<typeof setTimeout>>();

	constructor() {
		$effect(() => {
			const next = [...overlay.current.players];
			const key = JSON.stringify(next);
			if (key === this.scheduled) return;
			this.scheduled = key;

			const delayMs = Math.max(0, settings.current.playerSwitchDelayMs || 0);
			if (!delayMs) {
				this.players = next;
				return;
			}
			// not cancelled by the next switch: each one lands in turn, as they do in game
			const timer = setTimeout(() => {
				this.timers.delete(timer);
				this.players = next;
			}, delayMs);
			this.timers.add(timer);
		});

		$effect(() => () => {
			for (const timer of this.timers) clearTimeout(timer);
		});
	}
}
