/**
 * Shared types, tunables and pure logic for the Progress leaderboard.
 *
 * Kept separate from the components so the board's rules (which column a card
 * belongs in, when a card goes stale) can be read and changed in one place.
 */

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const REFRESH_INTERVAL = 30 * 1000;

/** A card goes yellow after (multiplier x its page length) minutes of no step change. */
export const STALE_YELLOW_MIN_PER_PAGE = 15;
/** ...and red after this one. Both are per page, so longer sullams get more slack. */
export const STALE_RED_MIN_PER_PAGE = 22;

export const BANNER_DURATION_MS = 6000;
export const MAX_BANNERS = 4;

export const POINTS_PER_PAGE = 550;
export const LINES_PER_PAGE = 15;

/**
 * Length under the name: whole lines, until rounding hits a full page (15),
 * then switch to unrounded pages with decimals.
 */
export function formatSulamLength(pages: number): string {
    const roundedLines = Math.round(pages * LINES_PER_PAGE);
    if (roundedLines >= LINES_PER_PAGE) {
        const shown = pages.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0');
        return `${shown} pgs`;
    }
    return `${roundedLines} lines`;
}

/** Nearest 0.5 pages (1.24 → 1.0, 1.25 → 1.5). Backend already does this. */
export function roundToHalf(pages: number): number {
    return Math.round(pages * 2) / 2;
}

/** Next 0.5 pages up. Exact halves stay put (8.0 → 8.0, 8.01 → 8.5). */
export function ceilToHalf(pages: number): number {
    return Math.ceil(pages * 2 - 1e-9) / 2;
}

/**
 * Y is ceiled from the start so leftover work always has a 0.5 slot
 * (8.2 stays 8.5 for the whole session). X rounds nearest, and only
 * snaps to Y when they are actually finished.
 */
export function roundQadeemFraction(done: number, total: number): { done: number; total: number } {
    const t = ceilToHalf(total);
    let d = roundToHalf(done);
    if (done < total) {
        if (d >= t) d = t - 0.5;
    } else {
        d = t;
    }
    return { done: Math.max(d, 0), total: t };
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/**
 * One entry of `NewSullamProgress`. Fields below the divider only arrive when
 * the request sets `detailed_progress=true`.
 */
export type ProgressItem = {
    sulam_label?: string;
    steps_completed?: string[];
    range_points?: number;

    sulam_id?: string;
    entry_index?: number;
    current_step?: string | null;
    state?: string;
    created_at?: string | null;
    last_step_date?: string | null;
    count?: number;
    /** Highest 11–55 confirmation dated before the leaderboard start. */
    started_from?: string | null;
};

export type StudentRow = {
    user_id: string;
    full_name: string;
    schoolteacher?: string | null;
    NewPoints: number;
    OldPoints: number;
    QadeemPoints: number;
    TikrarPoints: number;
    TotalPoints: number;
    /**
     * Whether the student earned a qadeem star today. Note this is NOT a
     * three-way flag in practice: the API returns false both for "has qadeem,
     * not finished" and for "has no qadeem at all". Use HasQadeem to separate
     * those cases.
     */
    QadeemStatus: boolean | null;
    /** Whether the student has any qadeem work. Only sent with detailed_progress=true. */
    HasQadeem?: boolean;
    /**
     * Page-reps of qadeem required today (Y in X/Y), in points.
     * Length of each qadeem sulam × that day's denominator (5, 4, 3, 2, 1).
     * detailed_progress only.
     */
    QadeemAssignedRange?: number;
    /** Same sullams counted once, ignoring the repetition multiplier (Z range). */
    QadeemAssignedUniqueRange?: number;
    /** Page-reps done today (X in X/Y). Last tick of a 5/5 etc. waits on confirmation. */
    QadeemCoveredRange?: number;
    /** Same as X, but only work finished after the jalseh started. */
    QadeemCoveredInWindow?: number;
    QadeemRange: number;
    JadeedRange: number;
    NewSullamProgress?: ProgressItem[];
    QadeemSullamProgress?: ProgressItem[];
};

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export const COLUMNS = [
    'qadeem', 'not-started', 'new', '11', '22', '33', '44', 'completed',
] as const;

export type ColumnKey = typeof COLUMNS[number];

export const COLUMN_LABEL: Record<ColumnKey, string> = {
    'not-started': 'Listening',
    'qadeem': 'Qadeem',
    'new': '0',
    '11': '11',
    '22': '22',
    '33': '33',
    '44': '44',
    'completed': 'Summary',
};

/**
 * Each column is a soft pastel panel with its label and count drawn straight
 * onto it — no solid header bar. `accent` colours the label and the big step
 * number on each card; `bg` tints the panel.
 *
 * Panel tints stay pale on purpose: staleness is carried by the card itself
 * (see STALE_STYLES in SullamCard), and a strong panel would compete with it.
 */
export type ColumnTheme = { bg: string; accent: string };

export const NEW_STEPS = ['11', '22', '33', '44', '55'] as const;
export const QADEEM_STEPS = ['5', '4', '3', '2', '1'] as const;

export function ordinalRank(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

export const COLUMN_THEME: Record<ColumnKey, ColumnTheme> = {
    'not-started': { bg: 'teal.50', accent: 'teal.600' },
    'qadeem': { bg: 'blue.50', accent: 'blue.500' },
    'new': { bg: 'green.50', accent: 'green.600' },
    '11': { bg: 'cyan.50', accent: 'cyan.700' },
    '22': { bg: 'purple.50', accent: 'purple.600' },
    '33': { bg: 'orange.50', accent: 'orange.600' },
    '44': { bg: 'pink.50', accent: 'pink.600' },
    'completed': { bg: 'gray.100', accent: 'gray.700' },
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type SullamCard = {
    kind: 'sullam';
    key: string;
    userId: string;
    name: string;
    label?: string;
    pages: number;
    lines: number;
    /** ms epoch the "open for" timer counts from, or null if unknown (old API). */
    createdAt: number | null;
    /** ms epoch the staleness clock counts from. */
    staleClockStart: number;
    currentStep: string | null;
    /** Running step counter, shown as the big number on the card. */
    step: number | null;
    /** Highest pre-session 11–55 confirmation, e.g. "33". */
    startedFrom?: string | null;
    /** The student already took another sullam to 55 this session. */
    ownerFinishedSullam: boolean;
};

export type StudentCard = {
    kind: 'student';
    key: string;
    userId: string;
    name: string;
    variant: 'qadeem' | 'idle' | 'completed';
    donePages: number;
    totalPages: number;
    /** Distinct pages assigned, overlaps collapsed. Undefined on an older API. */
    rangePages?: number;
    /** Total lines across the student's completed sullams. 'completed' only. */
    lines?: number;
};

export type SummaryTile = {
    pages: number;
    steps: string[];
};

export type SummaryCard = {
    kind: 'summary';
    key: string;
    userId: string;
    name: string;
    rank: number;
    totalPoints: number;
    qadeemPages: number;
    qadeemStar: boolean;
    newTiles: SummaryTile[];
    /** Took a sullam all the way to 55 during this session. */
    finishedSullam: boolean;
};

export type BoardCard = SullamCard | StudentCard | SummaryCard;
export type Board = Record<ColumnKey, BoardCard[]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a duration as HH:MM:SS. Hours are not wrapped — a 3-day-old sullam reads 72:xx:xx. */
export function formatDuration(ms: number): string {
    if (!isFinite(ms) || ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse a date from either API shape.
 *
 * `/leaderboard/<id>` hands back ISO strings, but `/leaderboard/get/<id>` returns
 * `lb.to_json()` — MongoEngine extended JSON, where a date is `{$date: 1756...}`
 * with a *numeric* epoch (and occasionally `{$date: {$numberLong: "..."}}`).
 * `Date.parse` only accepts strings, so the numeric form has to be handled
 * explicitly or it silently yields NaN.
 */
export function parseApiDate(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return isNaN(value) ? null : value;
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        return isNaN(ms) ? null : ms;
    }
    if (typeof value === 'object') {
        if ('$date' in value) return parseApiDate(value.$date);
        if ('$numberLong' in value) return parseApiDate(Number(value.$numberLong));
    }
    return null;
}

function parseTime(value?: string | null): number | null {
    return parseApiDate(value);
}

/** Highest step reached. Falls back to `steps_completed` when the API predates `current_step`. */
export function resolveCurrentStep(item: ProgressItem): string | null {
    if (item.current_step !== undefined) return item.current_step;
    const steps = item.steps_completed || [];
    return steps.length ? steps[steps.length - 1] : null;
}

/**
 * Milestone thresholds on the running step counter. A sulam sits in a column
 * until it reaches the next milestone, so count 51 belongs to the 44 column.
 * Mirrors confirmation_level_limits in the backend's sulamAPI.
 */
export const STEP_MILESTONES: { min: number; column: ColumnKey }[] = [
    { min: 55, column: 'completed' },
    { min: 44, column: '44' },
    { min: 33, column: '33' },
    { min: 22, column: '22' },
    { min: 11, column: '11' },
    { min: 0, column: 'new' },
];

export function countToColumn(count: number): ColumnKey {
    const hit = STEP_MILESTONES.find((m) => count >= m.min);
    return hit ? hit.column : 'new';
}

export function stepToColumn(step: string | null): ColumnKey {
    switch (step) {
        case '11': return '11';
        case '22': return '22';
        case '33': return '33';
        case '44': return '44';
        case '55': return 'completed';
        default: return 'new';
    }
}

export type StaleLevel = 'fresh' | 'yellow' | 'red';

/**
 * Staleness is measured from the last step change — or, for a sullam with no
 * steps yet, from when it was opened — clamped to the leaderboard start so a
 * sullam carried over from a previous day begins the session fresh and earns
 * its colour rather than loading already red.
 */
export function getStaleLevel(card: SullamCard, now: number, column: ColumnKey): StaleLevel {
    // Finished work cannot stall.
    if (column === 'completed') return 'fresh';
    const pages = card.pages;
    if (!pages || pages <= 0) return 'fresh';
    const minsIdle = (now - card.staleClockStart) / 60000;
    if (minsIdle >= STALE_RED_MIN_PER_PAGE * pages) return 'red';
    if (minsIdle >= STALE_YELLOW_MIN_PER_PAGE * pages) return 'yellow';
    return 'fresh';
}

// ---------------------------------------------------------------------------
// Board assembly
// ---------------------------------------------------------------------------

function emptyBoard(): Board {
    return COLUMNS.reduce((acc, key) => {
        acc[key] = [];
        return acc;
    }, {} as Board);
}

/**
 * Whether any sullam reached 55 during the session. The 55 confirmation is the
 * last step, so its date is `last_step_date`; a sullam finished on an earlier
 * day and still listed must not light the card up. An API too old to send the
 * date gets the benefit of the doubt.
 */
export function finishedSullamInSession(items: ProgressItem[] | undefined, leaderboardStartMs: number): boolean {
    return (items || []).some((item) => {
        const column = item.count == null
            ? stepToColumn(resolveCurrentStep(item))
            : countToColumn(item.count);
        if (column !== 'completed') return false;
        const finishedAt = parseTime(item.last_step_date);
        return finishedAt == null || finishedAt >= leaderboardStartMs;
    });
}

function tilesFromProgress(items?: ProgressItem[]): SummaryTile[] {
    return (items || [])
        .filter((item) => (item.steps_completed || []).length > 0)
        .map((item) => ({
            pages: (item.range_points || 0) / POINTS_PER_PAGE,
            steps: item.steps_completed || [],
        }));
}

/**
 * Place every student and sullam into its column.
 *
 * The last six columns hold one card per sullam. The first two are per student:
 * a student sits in Qadeem while their old section is in progress, moves to
 * "Did not start" once it is done, and leaves that column as soon as they open
 * a sullam. Summary lists everyone, ranked like the total leaderboard.
 */
export function buildBoard(rows: StudentRow[], leaderboardStartMs: number): Board {
    const board = emptyBoard();

    rows.forEach((row) => {
        // Fall back to "did they do any qadeem in the window" on an API that
        // predates HasQadeem, so the board still behaves sensibly.
        const hasQadeem = row.HasQadeem ?? (row.QadeemRange || 0) > 0;
        // A student's sullams stay hidden until their qadeem is done, so the
        // board reads strictly left to right: Qadeem -> Did not start -> ladder.
        const qadeemInProgress = hasQadeem && row.QadeemStatus !== true;
        const items = qadeemInProgress ? [] : (row.NewSullamProgress || []);
        const finishedSullam = finishedSullamInSession(row.NewSullamProgress, leaderboardStartMs);

        items.forEach((item, i) => {
            const rangePoints = item.range_points || 0;
            const pages = rangePoints / POINTS_PER_PAGE;
            const step = resolveCurrentStep(item);
            const lastStep = parseTime(item.last_step_date);
            const created = parseTime(item.created_at);
            const column = item.count == null
                ? stepToColumn(step)
                : countToColumn(item.count);

            const card: SullamCard = {
                kind: 'sullam',
                // sulam_id is absent on a pre-flag API; fall back to something stable
                // within the render so React and framer-motion still have a key.
                key: `${item.sulam_id ?? `${row.user_id}-${i}`}:${item.entry_index ?? i}`,
                userId: row.user_id,
                name: row.full_name,
                label: item.sulam_label,
                pages,
                lines: pages * LINES_PER_PAGE,
                createdAt: created,
                // Measure idleness from the last milestone confirmation (11/22/33/
                // 44/55); before the first one, from when the sullam was opened.
                // Either way never earlier than leaderboard start, so a sullam
                // carried over from a previous day begins the session fresh
                // instead of loading already red.
                staleClockStart: Math.max(lastStep ?? created ?? -Infinity, leaderboardStartMs),
                currentStep: step,
                step: item.count ?? null,
                startedFrom: item.started_from ?? null,
                ownerFinishedSullam: finishedSullam,
            };

            if (column === 'completed') {
                // Finished sullams live on the Summary card as New tiles, not
                // as their own column cards.
                return;
            }

            board[column].push(card);
        });

        if (qadeemInProgress) {
            // X/Y = page-reps done over page-reps required today. Z is Y
            // without the repetition multiplier. Backend already rounded to
            // 0.5 pages; round again so a pre-rounding API still displays cleanly.
            const assigned = row.QadeemAssignedRange;
            const covered = row.QadeemCoveredRange ?? row.QadeemRange ?? 0;
            const [donePoints, totalPoints] = assigned == null
                ? [row.OldPoints || 0, row.QadeemRange || 0]
                : [covered, assigned];
            const uniquePoints = row.QadeemAssignedUniqueRange;
            const rawDone = donePoints / POINTS_PER_PAGE;
            const rawTotal = totalPoints / POINTS_PER_PAGE;
            const { done, total } = roundQadeemFraction(rawDone, rawTotal);
            let rangePages: number | undefined;
            if (uniquePoints != null) {
                rangePages = ceilToHalf(uniquePoints / POINTS_PER_PAGE);
                if (total > 0 && rangePages <= 0) rangePages = 0.5;
            }

            board.qadeem.push({
                kind: 'student',
                key: `q:${row.user_id}`,
                userId: row.user_id,
                name: row.full_name,
                variant: 'qadeem',
                donePages: done,
                totalPages: total,
                rangePages,
            });
        } else if (items.length === 0) {
            // Qadeem done (or none to do) and nothing opened yet.
            board['not-started'].push({
                kind: 'student',
                key: `n:${row.user_id}`,
                userId: row.user_id,
                name: row.full_name,
                variant: 'idle',
                donePages: 0,
                totalPages: 0,
            });
        }
    });

    const summaries: SummaryCard[] = rows.map((row) => {
        // Jalseh-only pages. Do not fall back to the 5am-day X — that is
        // what put pre-session qadeem on a later board.
        const covered = row.QadeemCoveredInWindow ?? 0;
        return {
            kind: 'summary',
            key: `s:${row.user_id}`,
            userId: row.user_id,
            name: row.full_name,
            rank: 0,
            totalPoints: row.TotalPoints || 0,
            qadeemPages: roundToHalf(covered / POINTS_PER_PAGE),
            qadeemStar: row.QadeemStatus === true,
            newTiles: tilesFromProgress(row.NewSullamProgress),
            finishedSullam: finishedSullamInSession(row.NewSullamProgress, leaderboardStartMs),
        };
    });
    summaries.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (a.totalPoints === 0 && a.qadeemStar !== b.qadeemStar) {
            return a.qadeemStar ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    summaries.forEach((card, i) => {
        card.rank = i + 1;
        board.completed.push(card);
    });

    // Greatest-to-least in every column that has a number: qadeem by pages
    // done (then by assigned if still at 0), sullam columns by step count.
    COLUMNS.forEach((key) => {
        if (key === 'qadeem') {
            board[key].sort((a, b) => {
                const xa = a.kind === 'student' ? a.donePages : 0;
                const xb = b.kind === 'student' ? b.donePages : 0;
                if (xb !== xa) return xb - xa;
                if (xa === 0) {
                    const ya = a.kind === 'student' ? a.totalPages : 0;
                    const yb = b.kind === 'student' ? b.totalPages : 0;
                    return yb - ya || a.name.localeCompare(b.name);
                }
                return a.name.localeCompare(b.name);
            });
        } else if (key === 'completed') {
            // Already ranked by TotalPoints above.
        } else if (key === 'not-started') {
            board[key].sort((a, b) => a.name.localeCompare(b.name));
        } else {
            board[key].sort((a, b) => {
                const sa = a.kind === 'sullam' ? (a.step ?? 0) : 0;
                const sb = b.kind === 'sullam' ? (b.step ?? 0) : 0;
                return sb - sa || a.name.localeCompare(b.name);
            });
        }
    });

    return board;
}
