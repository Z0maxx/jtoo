import type { MapFileName } from './types.svelte';
import jumpOdyssey from './assets/jump_odyssey.png';

// our own images for maps whose Tempus image is missing or wrong. Keyed by the map's name without
// a version, matching the name itself (jump_odyssey) and any version of it (jump_odyssey_rc5)
const MAP_IMAGE_OVERRIDES: Record<string, string> = {
	jump_odyssey: jumpOdyssey
};

export function mapImageOverride(fileName: MapFileName): string | undefined {
	const name = fileName.trim().toLowerCase();
	for (const [base, url] of Object.entries(MAP_IMAGE_OVERRIDES)) {
		if (name === base || name.startsWith(base + '_')) return url;
	}
}
