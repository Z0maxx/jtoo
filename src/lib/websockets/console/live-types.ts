// Copied unchanged from jump-fortress/jf-console backend/live/types.ts
// at commit 8099796 (deployed with a08dcee, the merge of PR #1).
// Don't edit this file by hand: copy it again when the console's live contract changes.

// Public contract of the live SSE endpoints. This file has no imports so that consumers
// (the JTOO overlay, the public leaderboard, the website) can import or copy it as is.
//
// Conventions:
// - Durations are integer milliseconds (`...Ms`).
// - Timestamps are absolute epoch milliseconds (`...At`, `serverTime`).
// - `revision` increases with every change and is also sent as the SSE `id:`.

export type SteamID3 = number; // account number of a SteamID3, `[U:1:N]` -> N

export type RaceMode = 'mass-single' | 'mass-multi' | 'duel';

export type RaceWindowState = 'armed' | 'racing' | 'overtime' | 'ended';

export type PlayerStatus =
    'idle' | 'running' | 'finished' | 'withdrawn' | 'disqualified' | 'disconnected';

export interface LiveContext {
    tournamentId: string | null;
    stage: string | null; // current round of the tournament
    map: string; // map currently being played
}

export interface RaceWindow {
    state: RaceWindowState;
    startsAt: number | null;
    endsAt: number | null; // null when the race has no time limit (mass-single)
}

export interface LeaderboardEntry {
    position: number;
    steamId3: SteamID3;
    status: PlayerStatus;
    runStartedAt: number | null; // set on timer_start. Clients animate the run timer from this
    runEndedAt: number | null; // set when the run stops or finishes; null while running
    lastRunMs: number | null; // game time of the last finished run; null if it was aborted
    prMs: number | null;
    prSplitsMs: (number | null)[]; // aligned to RaceSnapshot.checkpoints
    currentSplitsMs: (number | null)[]; // aligned to RaceSnapshot.checkpoints
    bestProgress: { checkpointCount: number; timeMs: number | null };
    gapToLeaderMs: number | null;
}

export interface RaceSnapshot {
    revision: number;
    serverTime: number;
    sessionId: number;
    mode: RaceMode;
    context: LiveContext;
    roundIndex: number | null;
    window: RaceWindow;
    checkpoints: string[]; // ordered
    leaderboard: LeaderboardEntry[];
}

// Sent instead of a RaceSnapshot when no race has started since the console booted.
export interface IdleSnapshot {
    revision: number;
    serverTime: number;
    sessionId: null;
}

export interface TournamentRound {
    roundIndex: number;
    sessionId: number;
    map: string;
    stage: string;
    finalized: boolean;
    voided: boolean; // kept for the record, but doesn't count toward standings
    results: RoundResultEntry[]; // final results, corrections applied; empty until finalized
}

// One player's final result in a round.
export interface RoundResultEntry {
    placement: number;
    steamId3: SteamID3;
    status: PlayerStatus;
    prMs: number | null;
    bestProgress: { checkpointCount: number; timeMs: number | null };
}

// average-placement: the average placement across rounds, lower is better.
// rjr-points: Rocket Jump Royale points summed across rounds, higher is better.
export type ScoringMethod = 'average-placement' | 'rjr-points';

export interface TournamentStanding {
    position: number;
    steamId3: SteamID3;
    score: number; // an average placement or a points total, per TournamentSnapshot.scoring
    placements: (number | null)[]; // aligned to TournamentSnapshot.rounds; null = missed
}

export interface TournamentSnapshot {
    revision: number;
    serverTime: number;
    tournamentId: string;
    name: string;
    kind: 'mass' | 'duel'; // a tournament holds mass races or duels, never both
    scoring: ScoringMethod;
    rounds: TournamentRound[];
    standings: TournamentStanding[];
}

// SSE event names. `/live/race` sends `race` or `idle`; `/live/tournament/:id` sends `tournament`.
export interface LiveStreamEvents {
    race: RaceSnapshot;
    idle: IdleSnapshot;
    tournament: TournamentSnapshot;
}
