import { PersistentState } from '@friendofsvelte/state';
import type { Donation } from './types.svelte';

// moderation verdicts for donation messages by donation id, kept across scene switches and
// reloads, so a message is only ever checked once and shows straight away after that
const verdicts = new PersistentState<Record<string, boolean>>(
	'messageModerationVerdicts',
	{},
	'localStorage'
);
const pending = new Map<string, Promise<boolean>>();

/** the cached verdict for the donation's message: undefined when it hasn't been checked yet */
export function messageVerdict(donation: Donation): boolean | undefined {
	return verdicts.current[donation.id];
}

/**
 * Whether the donation's message is fine to show, checked once per donation. A failed check
 * isn't cached, so it's tried again the next time it's asked for.
 */
export function isMessageAcceptable(donation: Donation): Promise<boolean> {
	if (!donation.message) return Promise.resolve(false);
	const cached = verdicts.current[donation.id];
	if (cached !== undefined) return Promise.resolve(cached);

	let check = pending.get(donation.id);
	if (!check) {
		check = moderate(donation.message)
			.then((ok) => {
				verdicts.current[donation.id] = ok;
				return ok;
			})
			.catch(() => false)
			.finally(() => pending.delete(donation.id));
		pending.set(donation.id, check);
	}
	return check;
}

async function moderate(message: string): Promise<boolean> {
	const resp = await fetch('/api/message-moderation', {
		method: 'POST',
		body: JSON.stringify({ message })
	});
	if (!resp.ok) throw new Error(`message moderation: ${resp.status}`);
	const { isAcceptable } = (await resp.json()) as { isAcceptable: boolean };
	return isAcceptable;
}
