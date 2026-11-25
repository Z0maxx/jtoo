import { sleep } from '$lib/util';
import { JfRtdWebSocket, rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
import type { RequestHandler } from '@sveltejs/kit';

const jfRtdWs = new JfRtdWebSocket();
const effectQueue: string[] = [];
const secondsBetweenEffects = 60;
let processingQueue = false;

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response(`token is not included`, { status: 401 });
	}

	const effect = params.effect!;
	if (!rtdEffects.includes(effect)) {
		return new Response(`'${effect}' is not an rtd effect`, { status: 400 });
	}

	if (jfRtdWs.wsState !== WebSocket.OPEN) {
		if (jfRtdWs.wsState !== WebSocket.CONNECTING) {
			jfRtdWs.connect(token);
		}

		const connected = await new Promise<boolean>((res) => {
			jfRtdWs.addEventListener('open', () => res(true));
			jfRtdWs.addEventListener('error', () => res(false));
		});

		if (!connected) {
			return new Response('invalid token', { status: 401 });
		}
	}

	effectQueue.push(effect);
	processQueue();
	return new Response(null, { status: 204 });
};

async function processQueue() {
	if (processingQueue) return;

	processingQueue = true;
	while (effectQueue.length > 0) {
		const effect = effectQueue.shift();
		jfRtdWs.sendRtdEffect(effect!);
		await sleep(secondsBetweenEffects * 1000);
	}

	processingQueue = false;
}
