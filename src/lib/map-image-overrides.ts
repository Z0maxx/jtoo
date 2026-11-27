import type { MapFileName } from './types.svelte';
import jumpOdyssey from './assets/jump_odyssey.png';

// our own images for maps whose Tempus image is missing or wrong. Keyed by file name
// prefix so new map versions (e.g. jump_odyssey_rc5) still match.
const MAP_IMAGE_OVERRIDES: Record<string, string> = {
	jump_odyssey_: jumpOdyssey
};

export function mapImageOverride(fileName: MapFileName): string | undefined {
	for (const [prefix, url] of Object.entries(MAP_IMAGE_OVERRIDES)) {
		if (fileName.startsWith(prefix)) return url;
	}
}
