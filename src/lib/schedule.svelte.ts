import { overlay, settings } from './storage.svelte';

// The event schedule, read from a public Google Sheet's CSV export (which allows any origin).
// The sheet's timetable is found by its header row, the one starting with 'Segment', and runs
// until a 'TOTAL ...' row or a blank one. Columns are matched by their header names.

// the event's days, each a tab of the same sheet; a link without a gid is the first tab
export const scheduleDays = [
	{
		name: 'day 1',
		url: 'https://docs.google.com/spreadsheets/d/1J7_Vltigo-tFXc95MLPOXU6iwMi_QdKwNSXyEg5Si7Y/edit?gid=0#gid=0'
	},
	{
		name: 'day 2',
		url: 'https://docs.google.com/spreadsheets/d/1J7_Vltigo-tFXc95MLPOXU6iwMi_QdKwNSXyEg5Si7Y/edit?gid=1#gid=1'
	}
] as const;

// Preview: set to a segment's index (0 = the first row) to show it as LIVE, and the next as
// UP NEXT, whatever the time. -1 is before the show, segments.length after it. undefined uses
// the real time. Only applies in `npm run dev`, so a leftover value never reaches a build.
const PREVIEW_SEGMENT_INDEX: number | undefined = undefined;

// the sheet's times are CET; Europe/Paris follows CET/CEST
const SCHEDULE_TIME_ZONE = 'Europe/Paris';
const REFRESH_MS = 60_000;

export type ScheduleSegment = {
	segment: string;
	subtitle: string; // the column after 'Segment', eg: 'Details' or 'Stage / Match'
	start: string;
	end: string;
	casters: string;
	notes: string;
	// minutes since the start day's midnight, past 24h for segments after midnight
	startMinutes: number | undefined;
	endMinutes: number | undefined;
};

export type Schedule = {
	title: string;
	subtitle: string;
	segments: ScheduleSegment[];
};

export function sheetCsvUrl(sheetUrl: string): string | undefined {
	const id = sheetUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
	if (!id) return undefined;
	const gid = sheetUrl.match(/[#?&]gid=(\d+)/)?.[1] ?? '0';
	return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') {
				quoted = false;
			} else {
				cell += c;
			}
		} else if (c === '"') {
			quoted = true;
		} else if (c === ',') {
			row.push(cell);
			cell = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else {
			cell += c;
		}
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

// '8:30 p.m.', '12:47 a.m.', '20:30' -> minutes since midnight
export function parseTime(text: string): number | undefined {
	const m = text
		.trim()
		.toLowerCase()
		.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p)?\.?\s*m?\.?$/);
	if (!m) return undefined;
	let hours = Number(m[1]);
	const minutes = Number(m[2] ?? 0);
	if (m[3] === 'p' && hours < 12) hours += 12;
	if (m[3] === 'a' && hours === 12) hours = 0;
	if (hours > 23 || minutes > 59) return undefined;
	return hours * 60 + minutes;
}

export function parseSchedule(rows: string[][]): Schedule {
	const cells = (row: string[] | undefined) => (row ?? []).map((c) => c.trim());
	const firstCell = (row: string[] | undefined) => cells(row).find((c) => c) ?? '';

	const headerIndex = rows.findIndex((r) => cells(r)[0]?.toLowerCase() === 'segment');
	if (headerIndex < 0) throw new Error("no header row starting with 'Segment' in the sheet");

	const header = cells(rows[headerIndex]).map((h) => h.toLowerCase());
	const column = (name: string) => header.findIndex((h) => h.startsWith(name));
	const cols = {
		start: column('start'),
		end: column('end'),
		casters: column('caster'),
		notes: column('note')
	};

	const segments: ScheduleSegment[] = [];
	let previous = -Infinity;
	// times after midnight belong to the next day, so keep them increasing
	const unroll = (minutes: number | undefined) => {
		if (minutes === undefined) return undefined;
		while (minutes < previous) minutes += 24 * 60;
		previous = minutes;
		return minutes;
	};

	for (const row of rows.slice(headerIndex + 1)) {
		const r = cells(row);
		if (!r[0] || r[0].toUpperCase().startsWith('TOTAL')) break;
		const at = (i: number) => (i >= 0 ? (r[i] ?? '') : '');

		const start = at(cols.start);
		const end = at(cols.end);
		segments.push({
			segment: r[0],
			subtitle: at(1),
			start,
			end,
			casters: at(cols.casters),
			notes: at(cols.notes),
			startMinutes: unroll(parseTime(start)),
			endMinutes: unroll(parseTime(end))
		});
	}

	return {
		title: firstCell(rows[0]),
		subtitle: headerIndex > 1 ? firstCell(rows[1]) : '',
		segments
	};
}

// minutes since midnight in the schedule's time zone
export function scheduleNowMinutes(time: number): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: SCHEDULE_TIME_ZONE,
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23'
	}).formatToParts(time);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return get('hour') * 60 + get('minute');
}

/**
 * The index of the segment on air now, -1 before the first and segments.length after the last.
 * The sheet has times but no date, so the schedule is placed on whichever day it's nearest:
 * after midnight, times before the first segment count as the previous evening's broadcast.
 */
export function currentSegmentIndex(segments: ScheduleSegment[], time: number): number {
	if (import.meta.env.DEV && PREVIEW_SEGMENT_INDEX !== undefined) return PREVIEW_SEGMENT_INDEX;

	const first = segments.find((s) => s.startMinutes !== undefined)?.startMinutes;
	const last = segments.findLast((s) => s.endMinutes !== undefined)?.endMinutes;
	if (first === undefined || last === undefined) return -1;

	let now = scheduleNowMinutes(time);
	// between the broadcast's end (past midnight) and the next one's start, keep it ended
	if (now < first && now + 24 * 60 <= last + 12 * 60) now += 24 * 60;

	if (now < first) return -1;
	const i = segments.findIndex(
		(s) => s.startMinutes !== undefined && s.endMinutes !== undefined && now < s.endMinutes
	);
	return i < 0 ? segments.length : i;
}

// MARK: shared state
class ScheduleState {
	schedule: Schedule | undefined = $state();
	error = $state('');
	loading = $state(false);

	async load(sheetUrl: string) {
		const url = sheetCsvUrl(sheetUrl);
		if (!url) {
			this.error = 'not a google sheets url';
			return;
		}
		this.loading = true;
		try {
			const response = await fetch(url, { cache: 'no-store' });
			if (!response.ok) throw new Error(`sheet fetch failed: ${response.status}`);
			// a private sheet answers with google's sign-in page instead of csv
			if (!response.headers.get('content-type')?.includes('text/csv')) {
				throw new Error('the sheet isn\'t public ("anyone with the link can view")');
			}
			this.schedule = parseSchedule(parseCsv(await response.text()));
			this.error = '';
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			console.error('schedule:', e);
		} finally {
			this.loading = false;
		}
	}
}

export const schedule = new ScheduleState();

export function scheduleSheetUrl(): string {
	const day = scheduleDays[settings.current.scheduleDay ?? 0] ?? scheduleDays[0];
	return day.url;
}

/** Asks every open overlay to re-fetch the sheet now, instead of waiting for the next poll. */
export function refreshSchedule() {
	overlay.current.scheduleRefreshedAt = Date.now();
	schedule.load(scheduleSheetUrl());
}

/**
 * Loads the schedule now and every minute while the calling component is mounted, and again
 * whenever the day changes or the controls ask for a refresh.
 */
export function pollSchedule() {
	$effect(() => {
		const url = scheduleSheetUrl();
		void overlay.current.scheduleRefreshedAt;
		schedule.load(url);
		const interval = setInterval(() => schedule.load(url), REFRESH_MS);
		return () => clearInterval(interval);
	});
}
