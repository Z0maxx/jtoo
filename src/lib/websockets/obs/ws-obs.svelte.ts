import OBSWebSocket from 'obs-websocket-js';

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
});
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
	} catch (error: any) {
		console.error('obs failed to set the scene', error.code, error.message);
	}
}
