import OBSWebSocket from 'obs-websocket-js';
import { obsProgramScene } from '$lib/storage.svelte';

export const obs = new OBSWebSocket();

// shown on the controls dock; same states as the console's live feeds
export const obsStatus = $state<{ state: 'connecting' | 'open' | 'closed'; error: string }>({
	state: 'closed',
	error: ''
});

// 'Identified' means the password was accepted and calls will work, not just that the socket opened
obs.on('Identified', () => {
	obsStatus.state = 'open';
	obsStatus.error = '';
	// share the live scene with the overlay, which uses it to tell when OBS is on the Idle scene
	obs
		.call('GetCurrentProgramScene')
		.then(({ currentProgramSceneName }) => reportProgramScene(currentProgramSceneName))
		.catch((error) => console.error('obs failed to get the program scene', error));
});
obs.on('CurrentProgramSceneChanged', ({ sceneName }) => reportProgramScene(sceneName));

function reportProgramScene(name: string) {
	obsProgramScene.current = { name, at: Date.now() };
}
obs.on('ConnectionClosed', (error) => {
	obsStatus.state = 'closed';
	// 1000 is a normal close, e.g. from reconnecting; anything else is worth showing
	if (error.code && error.code !== 1000) obsStatus.error = error.message || `code ${error.code}`;
});

export async function obsConnect(ip: string, port: number | undefined, password: string) {
	if (!port) port = 4455;
	if (!ip) ip = 'localhost';
	const fullIp = `ws://${ip}:${port}`;
	obsStatus.state = 'connecting';
	obsStatus.error = '';
	try {
		await obs.connect(fullIp, password);
	} catch (error: any) {
		obsStatus.state = 'closed';
		obsStatus.error = error?.message || 'failed to connect';
		console.error('obs websocket failed to connect', error?.code, error?.message);
	}
}

export async function setScene(sceneName: string) {
	if (obsStatus.state !== 'open') return;
	try {
		await obs.call('SetCurrentProgramScene', { sceneName, sceneUuid: undefined });
		// OBS accepted the switch, so the live scene is known without waiting on an event: neither
		// the overlay's browser source nor this connection reliably hears about it
		reportProgramScene(sceneName);
	} catch (error: any) {
		console.error('obs failed to set the scene', error.code, error.message);
	}
}
