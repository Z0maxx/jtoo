import { page } from '$app/state';
import { obsProgramScene, settings } from './storage.svelte';

// OBS gives browser sources a window.obsstudio object and scene change events
// https://github.com/obsproject/obs-browser#js-bindings
type OBSStudio = {
	getCurrentScene?: (callback: (scene: { name: string }) => void) => void;
};

// OBS's current program scene as this browser source has heard it, with when it heard it;
// '' outside OBS (or before OBS has said)
const obsScene = $state({ name: '', at: 0 });

let listening = false;

const setOBSScene = (name: string) => {
	obsScene.name = name;
	obsScene.at = Date.now();
};

// the live scene from whichever report is newest: this browser source's own, or the controls'
// (shared through localStorage). the browser source isn't always told about a switch, so the
// controls' report covers that while they're open
const obsSceneName = () => {
	const fromControls = obsProgramScene.current;
	return fromControls.name && fromControls.at > obsScene.at ? fromControls.name : obsScene.name;
};

// call once from a page shown as an OBS browser source
export function watchOBSScene() {
	if (listening || typeof window === 'undefined') return;
	const obsstudio = (window as Window & { obsstudio?: OBSStudio }).obsstudio;
	if (!obsstudio) return;
	listening = true;

	// needs the browser source's page permissions to allow reading user information; below that
	// the answer has no name
	obsstudio.getCurrentScene?.((scene) => {
		if (scene?.name) setOBSScene(scene.name);
	});
	window.addEventListener('obsSceneChanged', (e) => {
		setOBSScene((e as CustomEvent<{ name: string }>).detail.name);
	});
}

export const idleOBSSceneName = () => settings.current.idleObsScene || 'Idle';

// the overlay is sitting on the broadcaster's Idle scene, so it shows the idle overlay scene without backgrounds
export const onIdleScene = () => {
	const name = obsSceneName();
	return name !== '' && name === idleOBSSceneName();
};

// scene tints and the moving background are hidden on the Idle scene, or with ?nobg in the url
export const showSceneBackground = () => !onIdleScene() && !page.url.searchParams.has('nobg');
