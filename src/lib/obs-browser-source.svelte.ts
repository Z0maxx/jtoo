import { page } from '$app/state';
import { settings } from './storage.svelte';

// OBS gives browser sources a window.obsstudio object and scene change events
// https://github.com/obsproject/obs-browser#js-bindings
type OBSStudio = {
	getCurrentScene?: (callback: (scene: { name: string }) => void) => void;
};

// OBS's current program scene, or '' outside OBS (or before OBS has answered)
const obsScene = $state({ name: '' });

let listening = false;

// call once from a page shown as an OBS browser source
export function watchOBSScene() {
	if (listening || typeof window === 'undefined') return;
	const obsstudio = (window as Window & { obsstudio?: OBSStudio }).obsstudio;
	if (!obsstudio) return;
	listening = true;

	// needs the browser source's page permissions to allow reading user information
	obsstudio.getCurrentScene?.((scene) => (obsScene.name = scene.name));
	window.addEventListener('obsSceneChanged', (e) => {
		obsScene.name = (e as CustomEvent<{ name: string }>).detail.name;
	});
}

export const idleOBSSceneName = () => settings.current.idleObsScene || 'Idle';

// the overlay is sitting on the broadcaster's Idle scene, so it shows the idle overlay scene without backgrounds
export const onIdleScene = () => obsScene.name !== '' && obsScene.name === idleOBSSceneName();

// scene tints and the moving background are hidden on the Idle scene, or with ?nobg in the url
export const showSceneBackground = () => !onIdleScene() && !page.url.searchParams.has('nobg');
