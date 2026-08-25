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
     * Total range of every qadeem-state sulam, in points. Fixed for the session,
     * unlike QadeemRange which grows as the student works. Overlapping sullams
     * count once each, since each is a separate review. detailed_progress only.
     */
    QadeemAssignedRange?: number;
    /** As above but with overlaps collapsed — the distinct pages covered. */
    QadeemAssignedUniqueRange?: number;
    /** Qadeem range covered in-window, excluding Tikrar. detailed_progress only. */
    QadeemCoveredRange?: number;
    QadeemRange: number;
    JadeedRange: number;
    NewSullamProgress?: ProgressItem[];
};

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export const COLUMNS = [
    'qadeem', 'not-started', 'new', '11', '22', '33', '44', 'completed',
] as const;

export type ColumnKey = typeof COLUMNS[number];

export const COLUMN_LABEL: Record<ColumnKey, string> = {
    'not-started': 'Not started',
    'qadeem': 'Qadeem',
    'new': 'New',
    '11': '11',
    '22': '22',
    '33': '33',
    '44': '44',
    'completed': 'Completed',
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

export const COLUMN_THEME: Record<ColumnKey, ColumnTheme> = {
    'not-started': { bg: 'gray.50', accent: 'gray.600' },
    'qadeem': { bg: 'blue.50', accent: 'blue.500' },
    'new': { bg: 'green.50', accent: 'green.600' },
    '11': { bg: 'cyan.50', accent: 'cyan.700' },
    '22': { bg: 'purple.50', accent: 'purple.600' },
    '33': { bg: 'orange.50', accent: 'orange.600' },
    '44': { bg: 'pink.50', accent: 'pink.600' },
    'completed': { bg: 'green.50', accent: 'green.700' },
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

export type BoardCard = SullamCard | StudentCard;
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
 * Place every student and sullam into its column.
 *
 * The last six columns hold one card per sullam. The first two are per student:
 * a student sits in Qadeem while their old section is in progress, moves to
 * "Did not start" once it is done, and leaves that column as soon as they open
 * a sullam.
 */
export function buildBoard(rows: StudentRow[], leaderboardStartMs: number): Board {
    const board = emptyBoard();
    // Completed is a per-student tally rather than one card per sullam: once
    // work is finished the individual sullams stop mattering, only the total.
    const completedLines: Record<string, { name: string; lines: number }> = {};

    rows.forEach((row) => {
        // Fall back to "did they do any qadeem in the window" on an API that
        // predates HasQadeem, so the board still behaves sensibly.
        const hasQadeem = row.HasQadeem ?? (row.QadeemRange || 0) > 0;
        // A student's sullams stay hidden until their qadeem is done, so the
        // board reads strictly left to right: Qadeem -> Did not start -> ladder.
        const qadeemInProgress = hasQadeem && row.QadeemStatus !== true;
        const items = qadeemInProgress ? [] : (row.NewSullamProgress || []);

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
            };

            if (column === 'completed') {
                const tally = completedLines[row.user_id]
                    || (completedLines[row.user_id] = { name: row.full_name, lines: 0 });
                tally.lines += card.lines;
                return;
            }

            board[column].push(card);
        });

        if (qadeemInProgress) {
            // Pages covered out of pages assigned. Both sides are raw ayah range,
            // so the ratio is a true 0-100%.
            //
            // Deliberately not OldPoints as the numerator: that is a *weighted*
            // sum (step level x range), so a student on step 5 scores five times
            // their actual range and the bar overflows.
            //
            // Without QadeemAssignedRange (an API predating the field) fall back
            // to the default board's pairing, which at least renders.
            const assigned = row.QadeemAssignedRange;
            // QadeemCoveredRange excludes Tikrar, which expands to a whole surah
            // segment and would otherwise push the ratio past 100%.
            const covered = row.QadeemCoveredRange ?? row.QadeemRange ?? 0;
            const [donePoints, totalPoints] = assigned == null
                ? [row.OldPoints || 0, row.QadeemRange || 0]
                : [covered, assigned];
            const uniquePoints = row.QadeemAssignedUniqueRange;

            board.qadeem.push({
                kind: 'student',
                key: `q:${row.user_id}`,
                userId: row.user_id,
                name: row.full_name,
                variant: 'qadeem',
                donePages: donePoints / POINTS_PER_PAGE,
                totalPages: totalPoints / POINTS_PER_PAGE,
                rangePages: uniquePoints == null ? undefined : uniquePoints / POINTS_PER_PAGE,
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

    Object.entries(completedLines).forEach(([userId, { name, lines }]) => {
        board.completed.push({
            kind: 'student',
            key: `c:${userId}`,
            userId,
            name,
            variant: 'completed',
            donePages: 0,
            totalPages: 0,
            lines,
        });
    });

    // Sullam and idle columns sort by name: stable ordering keeps cards from
    // reshuffling under the layout animation on every poll.
    COLUMNS.forEach((key) => {
        if (key === 'qadeem') {
            // Closest to finishing floats to the top, since this column drains.
            board[key].sort((a, b) => {
                const ra = a.kind === 'student' && a.totalPages ? a.donePages / a.totalPages : 0;
                const rb = b.kind === 'student' && b.totalPages ? b.donePages / b.totalPages : 0;
                return rb - ra || a.name.localeCompare(b.name);
            });
        } else {
            board[key].sort((a, b) => a.name.localeCompare(b.name));
        }
    });

    return board;
}
