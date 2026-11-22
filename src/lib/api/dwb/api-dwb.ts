import { fundraisingState } from '$lib/storage.svelte';
import type { DonationsOverview, Donation, DonationMilestone, Subscriber } from '$lib/types.svelte';
import { deepCopy, sleep } from '$lib/util';
import { createRateLimitedApi } from '../rate-limited-api';

export namespace Dwb {
	const participantEndpoint = () =>
		'/participants/' + fundraisingState.current.eventUrl.split('/').at(-1);
	const fetching = new Set<DwbModelName>();
	const fetchInterval = 16 * 1000;
	const eTags = new Map<DwbModelName, string>();
	const overviewSubscribers: Array<Subscriber<DonationsOverview>> = [];
	const donationsSubscribers: Array<Subscriber<Donation[]>> = [];
	const milestonesSubscribers: Array<Subscriber<DonationMilestone[]>> = [];

	let overview: DonationsOverview = { goal: 0, raised: 0, donationCount: 0 };
	let donations: Donation[] = fundraisingState.current.donations;
	let milestones: DonationMilestone[] = [];

  function overviewCopy() {
    return deepCopy(overview)
  }

  function donationsCopy() {
    return deepCopy(donations)
  }

  function milestonesCopy() {
    return deepCopy(milestones)
  }

	const fetchDwb = createRateLimitedApi({
		baseUrl: '/api/dwb',
		defaultTimeoutSeconds: 15,
		rateLimitedPerEndpoint: true
	});

	export function subscribeToDonationsOverview(callback: (overview: DonationsOverview) => void) {
		const id = crypto.randomUUID();
		overviewSubscribers.push({
			id,
			handler: callback
		});

		if (overview) {
			callback(overviewCopy());
		}

		fetchAndSetOverview();
		return id;
	}

	export function subscribeToDonations(callback: (newDonations: Donation[]) => void) {
		const id = crypto.randomUUID();
		donationsSubscribers.push({
			id,
			handler: callback
		});

		if (donations.length > 0) {
			callback(donationsCopy());
		}

		fetchAndSetDonations();
		return id;
	}

	export function subscribeToMilestones(callback: (milestones: DonationMilestone[]) => void) {
		const id = crypto.randomUUID();
		milestonesSubscribers.push({
			id,
			handler: callback
		});

		if (milestones.length > 0) {
			callback(milestonesCopy());
		}

		fetchAndSetMilestones();
		return id;
	}

	export function unsubscribeFromDonationsOverview(id: string) {
		removeById(overviewSubscribers, id);
		console.log('unsubbed');
	}

	export function unsubscribeFromDonations(id: string) {
		removeById(donationsSubscribers, id);
		console.log('unsubbed');
	}

	export function unsubscribeFromMilestones(id: string) {
		removeById(milestonesSubscribers, id);
		console.log('unsubbed');
	}

	async function fetchAndSetOverview() {
		let lastETag = '';
		fetchEndpointInLoop<DwbParticipantOverview>({
			endpoint: () => participantEndpoint(),
			modelName: 'overview',
			fetchUntil: () => overviewSubscribers.length > 0,
			callback: (dwbOverview) => {
				const eTag = eTags.get('overview');
				if (!eTag || eTag === lastETag) return;

				overview = {
					goal: dwbOverview.fundraisingGoal,
					raised: dwbOverview.sumDonations,
					donationCount: dwbOverview.numDonations
				};

				overviewSubscribers.forEach((s) => s.handler(overviewCopy()));
				lastETag = eTag;
			}
		});
	}

	async function fetchAndSetDonations() {
		let lastETag = '';
		fetchEndpointInLoop<DwbDonation[]>({
			endpoint: () =>
				`${participantEndpoint()}/donations?offset=${donations.length + 1}&orderBy=createdDateUTC%20ASC`,
			modelName: 'donations',
			fetchUntil: () => donationsSubscribers.length > 0,
			callback: (dwbDonations) => {
				const eTag = eTags.get('donations');
				if (!eTag || eTag === lastETag) return;

				const newDonations = dwbDonations.map((d) => ({
					id: d.donationID,
					name: d.displayName,
					amount: d.amount,
					message: d.message,
					avatarUrl: d.avatarImageUrl
				}));

				if (newDonations.length === 0) return;

				const newDonationIds = newDonations.map((d) => d.id);
				donations = donations.filter((d) => !newDonationIds.includes(d.id)).concat(newDonations);
				fundraisingState.current.donations = donations;
				donationsSubscribers.forEach((s) => s.handler(donationsCopy()));
				lastETag = eTag;
			}
		});
	}

	async function fetchAndSetMilestones() {
		let lastETag = '';
		fetchEndpointInLoop<DwbMilestone[]>({
			endpoint: () => participantEndpoint() + '/milestones',
			modelName: 'milestones',
			fetchUntil: () => milestonesSubscribers.length > 0,
			callback: (dwbMilestones) => {
				const eTag = eTags.get('milestones');
				if (!eTag || eTag === lastETag) return;

				milestones = dwbMilestones.map((m) => ({
					goal: m.fundraisingGoal,
					description: m.description,
					isActive: m.isActive,
					isComplete: m.isComplete
				}));

				if (milestones.length === 0) return;

				milestonesSubscribers.forEach((s) => s.handler(milestonesCopy()));
				lastETag = eTag;
			}
		});
	}

	async function fetchEndpointInLoop<TDwbModel>({
		endpoint,
		modelName,
		fetchUntil,
		callback
	}: {
		endpoint: () => string;
		modelName: DwbModelName;
		fetchUntil: () => boolean;
		callback: (result: TDwbModel) => void;
	}) {
		if (fetching.has(modelName)) {
			return;
		}

		fetching.add(modelName);
		while (fetchUntil()) {
			try {
				console.log(endpoint());
				const resp = await fetchDwb(endpoint(), eTags.get(modelName));
				if (resp.status === 304 || resp.status === 204) {
					await sleep(fetchInterval);
					continue;
				}

				const eTag = resp.headers.get('ETag');
				if (eTag) {
					eTags.set(modelName, eTag);
				}

				const result = (await resp.json()) as TDwbModel;
				callback(result);
			} catch (err) {
				console.log(err);
			}

			await sleep(fetchInterval);
		}

		fetching.delete(modelName);
	}

	function removeById(arr: { id: string }[], id: string) {
		const idx = arr.findIndex((i) => i.id === id);
		if (idx > -1) {
			arr.splice(idx, 1);
		}
	}

	type DwbModelName = 'overview' | 'donations' | 'milestones';

	type DwbParticipantOverview = {
		fundraisingGoal: number;
		sumDonations: number;
		numDonations: number;
	};

	type DwbDonation = {
		donationID: string;
		displayName: string;
		message: string;
		avatarImageUrl: string;
		amount: number;
	};

	type DwbMilestone = {
		fundraisingGoal: number;
		description: string;
		isActive: boolean;
		isComplete: boolean;
	};
}
