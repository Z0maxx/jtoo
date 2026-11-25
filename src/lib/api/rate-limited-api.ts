import { sleep, clampNum } from '$lib/util';

type FetchQueueItem = {
	endpoint: string;
	attempts: number;
	rateLimitAttempts: number;
	eTag?: string;
	resolve(response: Response): void;
	reject(reason: unknown): void;
};

type Config = {
	baseUrl: string;
	defaultTimeoutSeconds: number;
	rateLimitedPerEndpoint?: boolean;
};

const maxTimeout = 60 * 30 * 1000;
const maxAttempts = 5;
const maxRateLimitAttempts = 5;

export function createRateLimitedApi({
	baseUrl,
	defaultTimeoutSeconds,
	rateLimitedPerEndpoint = false
}: Config) {
	const defaultTimeout = defaultTimeoutSeconds * 1000;
	const queues = new Map<string, FetchQueueItem[]>();
	const processing = new Set<string>();

	function fetchApi(endpoint: string, eTag?: string): Promise<Response> {
		return new Promise<Response>((resolve, reject) => {
			const queueKey = rateLimitedPerEndpoint ? endpoint : '';
			let queue = queues.get(queueKey);
			if (!queue) {
				queue = [];
				queues.set(queueKey, queue);
			}

			queue.push({
				endpoint,
				attempts: 0,
				rateLimitAttempts: 0,
				eTag,
				resolve,
				reject
			});
			if (!processing.has(queueKey)) {
				processing.add(queueKey);
				void processQueue(queueKey, queue);
			}
		});
	}

	async function processQueue(queueKey: string, queue: FetchQueueItem[]) {
		let nextDelay = defaultTimeout;
		let failureDelay = defaultTimeout;

		try {
			// every request, including a failed or given-up one, is followed by a wait
			while (queue.length > 0) {
				const item = queue[0]!;

				try {
					const headers: Record<string, string> = {};
					if (item.eTag) {
						headers['If-None-Match'] = item.eTag;
					}

					const res = await fetch(baseUrl + item.endpoint, {
						signal: AbortSignal.timeout(5000),
						headers
					});

					if (res.status === 429) {
						item.rateLimitAttempts += 1;
						if (item.rateLimitAttempts >= maxRateLimitAttempts) {
							retire(item, queue);
							item.reject(new Error('API rate limit retries exhausted'));
						}

						// still rate limited for the next item, so wait out Retry-After either way
						nextDelay = retryAfterDelay(res);
					} else {
						retire(item, queue);
						item.resolve(res);
						nextDelay = defaultTimeout;
						failureDelay = defaultTimeout;
					}
				} catch (error) {
					item.attempts += 1;
					if (item.attempts >= maxAttempts) {
						retire(item, queue);
						item.reject(error);
						nextDelay = defaultTimeout;
						failureDelay = defaultTimeout;
					} else {
						failureDelay = Math.min(failureDelay * 2, maxTimeout);
						nextDelay = failureDelay;
					}
				}

				await sleep(nextDelay);
			}
		} finally {
			processing.delete(queueKey);
			if (queue.length > 0) {
				processing.add(queueKey);
				void processQueue(queueKey, queue);
			} else {
				queues.delete(queueKey);
			}
		}
	}

	function retryAfterDelay(response: Response) {
		// Retry-After is either seconds to wait or an HTTP date to wait until
		const header = response.headers.get('Retry-After')?.trim();
		let delay = defaultTimeout;
		if (header) {
			const retrySeconds = Number(header);
			const delayFromHeader = Number.isNaN(retrySeconds)
				? new Date(header).getTime() - Date.now()
				: retrySeconds * 1000 + 100;
			// an unparseable date gives NaN; keep the default then
			if (!Number.isNaN(delayFromHeader)) delay = delayFromHeader;
		}

		return clampNum(delay, 0, maxTimeout);
	}

	function retire(item: FetchQueueItem, queue: FetchQueueItem[]) {
		const index = queue.indexOf(item);
		if (index !== -1) {
			queue.splice(index, 1);
		}
	}

	return fetchApi;
}
