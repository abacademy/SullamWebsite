import {
    buildBoard, formatDuration, formatSulamLength, getStaleLevel, stepToColumn, countToColumn,
    resolveCurrentStep, parseApiDate, StudentRow, SullamCard, POINTS_PER_PAGE,
} from './progressLeaderboard';

const START = Date.parse('2026-08-26T12:00:00Z');
const ONE_PAGE = POINTS_PER_PAGE;

function row(over: Partial<StudentRow>): StudentRow {
    return {
        user_id: 'u1', full_name: 'Ahmad', NewPoints: 0, OldPoints: 0,
        QadeemPoints: 0, TikrarPoints: 0, TotalPoints: 0,
        QadeemStatus: null, QadeemRange: 0, JadeedRange: 0, ...over,
    };
}

function sulam(over: any = {}) {
    return {
        sulam_id: 's1', entry_index: 0, sulam_label: 'S2:1-10',
        steps_completed: [], current_step: null, state: 'New',
        range_points: ONE_PAGE, created_at: '2026-08-26T12:00:00Z',
        last_step_date: null, ...over,
    };
}

describe('formatSulamLength', () => {
    it('uses whole lines below a page', () => {
        expect(formatSulamLength(12 / 15)).toBe('12 lines');
        expect(formatSulamLength(14.4 / 15)).toBe('14 lines');
    });
    it('switches to unrounded pages once rounding reaches 15 lines', () => {
        expect(formatSulamLength(14.6 / 15)).toBe('0.97 pgs');
        expect(formatSulamLength(1)).toBe('1.0 pgs');
        expect(formatSulamLength(1.25)).toBe('1.25 pgs');
    });
});

describe('formatDuration', () => {
    it('pads to HH:MM:SS and does not wrap hours past a day', () => {
        expect(formatDuration(0)).toBe('00:00:00');
        expect(formatDuration(3661_000)).toBe('01:01:01');
        expect(formatDuration(72 * 3600_000)).toBe('72:00:00');
    });
    it('clamps negatives rather than rendering a minus sign', () => {
        expect(formatDuration(-5000)).toBe('00:00:00');
    });
});

describe('step to column', () => {
    it('maps the ladder, with no steps meaning New and 55 meaning Completed', () => {
        expect(stepToColumn(null)).toBe('new');
        expect(stepToColumn('11')).toBe('11');
        expect(stepToColumn('44')).toBe('44');
        expect(stepToColumn('55')).toBe('completed');
    });
    it('falls back to steps_completed when the API predates current_step', () => {
        expect(resolveCurrentStep({ steps_completed: ['11', '22'] })).toBe('22');
        expect(resolveCurrentStep({ steps_completed: [] })).toBe(null);
    });
});

describe('countToColumn', () => {
    it('buckets the running counter by milestone, not by exact match', () => {
        // 11/22/33/44/55 are milestones on a 0-70 counter, so a sulam sits in a
        // column until it reaches the next one.
        expect(countToColumn(0)).toBe('new');
        expect(countToColumn(5)).toBe('new');
        expect(countToColumn(10)).toBe('new');
        expect(countToColumn(11)).toBe('11');
        expect(countToColumn(21)).toBe('11');
        expect(countToColumn(22)).toBe('22');
        expect(countToColumn(43)).toBe('33');
        expect(countToColumn(51)).toBe('44');
        expect(countToColumn(55)).toBe('completed');
        expect(countToColumn(70)).toBe('completed');
    });
});

describe('card placement', () => {
    it('falls back to the default board pairing without QadeemAssignedRange', () => {
        const b = buildBoard([row({ HasQadeem: true, QadeemStatus: false, OldPoints: 275, QadeemRange: 1100 })], START);
        expect(b.qadeem).toHaveLength(1);
        expect(b['not-started']).toHaveLength(0);
        const card = b.qadeem[0];
        expect(card.kind === 'student' && card.donePages).toBe(0.5);
        expect(card.kind === 'student' && card.totalPages).toBe(2);
    });

    it('moves a finished-qadeem student with no sullam to Did not start', () => {
        const b = buildBoard([row({ QadeemStatus: true })], START);
        expect(b['not-started']).toHaveLength(1);
        expect(b.qadeem).toHaveLength(0);
    });

    it('drops a student out of Did not start once they open a sullam', () => {
        const b = buildBoard([row({ QadeemStatus: true, NewSullamProgress: [sulam()] })], START);
        expect(b['not-started']).toHaveLength(0);
        expect(b.new).toHaveLength(1);
    });

    it('hides a student\'s sullams until their qadeem is done', () => {
        const b = buildBoard([row({ HasQadeem: true, QadeemStatus: false, NewSullamProgress: [sulam()] })], START);
        expect(b.qadeem).toHaveLength(1);
        expect(b.new).toHaveLength(0);
        // Still not idle — they are busy with qadeem.
        expect(b['not-started']).toHaveLength(0);
    });

    it('reveals those sullams once qadeem completes', () => {
        const b = buildBoard([row({ QadeemStatus: true, NewSullamProgress: [sulam()] })], START);
        expect(b.qadeem).toHaveLength(0);
        expect(b.new).toHaveLength(1);
    });

    it('treats a student with no qadeem work and no sullam as idle', () => {
        const b = buildBoard([row({ HasQadeem: false, QadeemStatus: false })], START);
        expect(b['not-started']).toHaveLength(1);
    });

    it('measures qadeem as page-reps done out of page-reps required', () => {
        const b = buildBoard([row({
            HasQadeem: true, QadeemStatus: false,
            QadeemCoveredRange: 3300,     // 2 pages × 3 reps done
            QadeemAssignedRange: 5500,    // 2 pages × 5 required
            QadeemAssignedUniqueRange: 1100, // 2 pages counted once
            OldPoints: 5500,
        })], START);
        const card = b.qadeem[0];
        expect(card.kind === 'student' && card.donePages).toBe(6);
        expect(card.kind === 'student' && card.totalPages).toBe(10);
        expect(card.kind === 'student' && card.rangePages).toBe(2);
    });

    it('keeps Y at 8.5 from the start for a ~8.2 assignment', () => {
        const mk = (covered: number) => buildBoard([row({
            HasQadeem: true, QadeemStatus: false,
            QadeemCoveredRange: covered * 550,
            QadeemAssignedRange: 8.2 * 550,
        })], START).qadeem[0];
        const start = mk(0);
        const late = mk(7.8);
        expect(start.kind === 'student' && start.totalPages).toBe(8.5);
        expect(start.kind === 'student' && start.donePages).toBe(0);
        expect(late.kind === 'student' && late.totalPages).toBe(8.5);
        expect(late.kind === 'student' && late.donePages).toBe(8);
    });

    it('does not show 0 range when Y is non-zero', () => {
        const b = buildBoard([row({
            HasQadeem: true, QadeemStatus: false,
            QadeemCoveredRange: 0,
            QadeemAssignedRange: 0.2 * 5 * 550, // 0/5 of a 0.2-page sulam
            QadeemAssignedUniqueRange: 0.2 * 550,
        })], START);
        const card = b.qadeem[0];
        expect(card.kind === 'student' && card.totalPages).toBeGreaterThan(0);
        expect(card.kind === 'student' && card.rangePages).toBe(0.5);
    });

    it('omits the range line when the API does not send it', () => {
        const b = buildBoard([row({
            HasQadeem: true, QadeemStatus: false,
            QadeemCoveredRange: 1100, QadeemAssignedRange: 4400,
        })], START);
        const card = b.qadeem[0];
        expect(card.kind === 'student' && card.rangePages).toBeUndefined();
    });

    it('keeps the assigned denominator fixed as the student works', () => {
        // The bug this replaces: QadeemRange was the denominator, so it grew
        // with the numerator and a half-done student read as finished.
        const mk = (covered: number) => buildBoard([row({
            HasQadeem: true, QadeemStatus: false,
            QadeemCoveredRange: covered, QadeemAssignedRange: 5500,
        })], START).qadeem[0];
        const early = mk(1100);
        const later = mk(3300);
        expect(early.kind === 'student' && early.totalPages).toBe(10);
        expect(later.kind === 'student' && later.totalPages).toBe(10);
        expect(later.kind === 'student' && later.donePages).toBe(6);
    });

    it('keeps a student with no qadeem work out of the Qadeem column', () => {
        // The API reports QadeemStatus false both for "not finished" and for
        // "no qadeem at all", so placement must key off HasQadeem instead.
        const b = buildBoard([row({
            HasQadeem: false, QadeemStatus: false, QadeemRange: 0,
            NewSullamProgress: [sulam()],
        })], START);
        expect(b.qadeem).toHaveLength(0);
        expect(b.new).toHaveLength(1);
    });

    it('falls back to QadeemRange when the API predates HasQadeem', () => {
        const withWork = buildBoard([row({ QadeemStatus: false, QadeemRange: 1100 })], START);
        expect(withWork.qadeem).toHaveLength(1);
        const without = buildBoard([row({ QadeemStatus: false, QadeemRange: 0 })], START);
        expect(without.qadeem).toHaveLength(0);
        expect(without['not-started']).toHaveLength(1);
    });

    it('places a sullam by its counter and labels it with that counter', () => {
        // The reported bug: counts of 10 and 5 both showed as step 0 in New,
        // because placement keyed off in-window milestone confirmations only.
        const b = buildBoard([row({
            HasQadeem: false, QadeemStatus: false,
            NewSullamProgress: [
                sulam({ sulam_id: 'a', count: 10, steps_completed: [], current_step: null }),
                sulam({ sulam_id: 'b', count: 5, steps_completed: [], current_step: null }),
                sulam({ sulam_id: 'c', count: 51, steps_completed: [], current_step: null }),
            ],
        })], START);
        expect(b.new).toHaveLength(2);
        expect(b.new.map((c) => (c as SullamCard).step)).toEqual([10, 5]);
        expect(b['44']).toHaveLength(1);
        expect((b['44'][0] as SullamCard).step).toBe(51);
    });

    it('carries the pre-session milestone as startedFrom', () => {
        const b = buildBoard([row({
            HasQadeem: false, QadeemStatus: false,
            NewSullamProgress: [sulam({ count: 35, started_from: '33' })],
        })], START);
        expect((b['33'][0] as SullamCard).startedFrom).toBe('33');
    });

    it('sorts step columns greatest count first', () => {
        const b = buildBoard([
            row({ user_id: 'u1', full_name: 'A', HasQadeem: false, QadeemStatus: false,
                  NewSullamProgress: [sulam({ sulam_id: 'a', count: 45 })] }),
            row({ user_id: 'u2', full_name: 'B', HasQadeem: false, QadeemStatus: false,
                  NewSullamProgress: [sulam({ sulam_id: 'b', count: 48 })] }),
        ], START);
        expect(b['44'].map((c) => (c as SullamCard).step)).toEqual([48, 45]);
    });

    it('sorts qadeem by X, then by Y among those still at 0', () => {
        const b = buildBoard([
            row({ user_id: 'u1', full_name: 'A', HasQadeem: true, QadeemStatus: false,
                  QadeemCoveredRange: 0, QadeemAssignedRange: 1100 }),           // 0 / 2
            row({ user_id: 'u2', full_name: 'B', HasQadeem: true, QadeemStatus: false,
                  QadeemCoveredRange: 0, QadeemAssignedRange: 5500 }),           // 0 / 10
            row({ user_id: 'u3', full_name: 'C', HasQadeem: true, QadeemStatus: false,
                  QadeemCoveredRange: 2200, QadeemAssignedRange: 5500 }),        // 4 / 10
            row({ user_id: 'u4', full_name: 'D', HasQadeem: true, QadeemStatus: false,
                  QadeemCoveredRange: 1100, QadeemAssignedRange: 2200 }),        // 2 / 4
        ], START);
        expect(b.qadeem.map((c) => c.name)).toEqual(['C', 'D', 'B', 'A']);
    });

    it('runs the stale clock off the last milestone confirmation', () => {
        const milestone = START + 40 * 60_000;
        const b = buildBoard([row({
            HasQadeem: false, QadeemStatus: false,
            NewSullamProgress: [sulam({
                count: 24,
                last_step_date: new Date(milestone).toISOString(),
            })],
        })], START);
        expect((b['22'][0] as SullamCard).staleClockStart).toBe(milestone);
    });

    it('does not reset the stale clock on increments between milestones', () => {
        // Climbing 22 -> 23 -> 24 leaves last_step_date at the 22 confirmation,
        // so the card keeps ageing until the next milestone.
        const milestone = START + 10 * 60_000;
        const at = (count: number) => buildBoard([row({
            HasQadeem: false, QadeemStatus: false,
            NewSullamProgress: [sulam({
                count, range_points: POINTS_PER_PAGE,
                last_step_date: new Date(milestone).toISOString(),
            })],
        })], START)['22'][0] as SullamCard;
        expect(at(22).staleClockStart).toBe(milestone);
        expect(at(24).staleClockStart).toBe(milestone);
        expect(getStaleLevel(at(24), milestone + 23 * 60_000, '22')).toBe('red');
    });

    it('files each sullam by its highest step and keeps completions off the ladder', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [
                sulam({ sulam_id: 'a', current_step: '22' }),
                sulam({ sulam_id: 'b', current_step: '55' }),
            ],
        })], START);
        expect(b['22']).toHaveLength(1);
        expect(b.completed).toHaveLength(1);
        expect(b.completed[0].kind).toBe('summary');
    });

    it('puts finished sullams on the Summary card, not as a merged lines total', () => {
        const b = buildBoard([row({
            HasQadeem: false, QadeemStatus: false,
            NewSullamProgress: [
                sulam({ sulam_id: 'a', count: 55, range_points: POINTS_PER_PAGE, steps_completed: ['55'] }),
                sulam({ sulam_id: 'b', count: 60, range_points: POINTS_PER_PAGE * 2, steps_completed: ['55'] }),
                sulam({ sulam_id: 'c', count: 30, range_points: POINTS_PER_PAGE }),
            ],
        })], START);
        expect(b.completed).toHaveLength(1);
        const card = b.completed[0];
        expect(card.kind).toBe('summary');
        expect(card.kind === 'summary' && card.newTiles).toHaveLength(2);
        expect(b['22']).toHaveLength(1);
    });

    it('ranks Summary by TotalPoints like the total leaderboard', () => {
        const b = buildBoard([
            row({ user_id: 'u1', full_name: 'A', TotalPoints: 100, HasQadeem: false, QadeemStatus: false }),
            row({ user_id: 'u2', full_name: 'B', TotalPoints: 900, HasQadeem: false, QadeemStatus: false }),
            row({ user_id: 'u3', full_name: 'C', TotalPoints: 400, HasQadeem: false, QadeemStatus: false }),
        ], START);
        expect(b.completed.map((c) => c.name)).toEqual(['B', 'C', 'A']);
        expect(b.completed.map((c) => (c.kind === 'summary' ? c.rank : 0))).toEqual([1, 2, 3]);
    });

    it('among zeros, puts qadeem-star students above the rest', () => {
        const b = buildBoard([
            row({ user_id: 'u1', full_name: 'A', TotalPoints: 0, QadeemStatus: false }),
            row({ user_id: 'u2', full_name: 'B', TotalPoints: 0, QadeemStatus: true }),
            row({ user_id: 'u3', full_name: 'C', TotalPoints: 50, QadeemStatus: false }),
        ], START);
        expect(b.completed.map((c) => c.name)).toEqual(['C', 'B', 'A']);
    });

    it('counts only qadeem finished during the jalseh on Summary', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            QadeemCoveredRange: 275,       // 0.5 pgs done at noon
            QadeemCoveredInWindow: 0,      // none of it after 5pm
        })], START);
        const card = b.completed[0];
        expect(card.kind).toBe('summary');
        expect(card.kind === 'summary' && card.qadeemPages).toBe(0);
        expect(card.kind === 'summary' && card.qadeemStar).toBe(true);
    });

    it('gives merge sub-ranges of one sullam distinct keys', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [sulam({ entry_index: 0 }), sulam({ entry_index: 1 })],
        })], START);
        expect(b.new).toHaveLength(2);
        expect(b.new[0].key).not.toBe(b.new[1].key);
    });
});

describe('staleness', () => {
    const card = (over: Partial<SullamCard> = {}): SullamCard => ({
        kind: 'sullam', key: 'k', userId: 'u1', name: 'Ahmad',
        pages: 1, lines: 15, createdAt: START, staleClockStart: START,
        currentStep: null, step: 0, ...over,
    });

    it('crosses to yellow at 15 min/page and red at 22 min/page', () => {
        expect(getStaleLevel(card(), START + 14 * 60_000, 'new')).toBe('fresh');
        expect(getStaleLevel(card(), START + 15 * 60_000, 'new')).toBe('yellow');
        expect(getStaleLevel(card(), START + 22 * 60_000, 'new')).toBe('red');
    });

    it('scales the thresholds with page length', () => {
        const twoPages = card({ pages: 2 });
        expect(getStaleLevel(twoPages, START + 20 * 60_000, 'new')).toBe('fresh');
        expect(getStaleLevel(twoPages, START + 30 * 60_000, 'new')).toBe('yellow');
    });

    it('never stales a completed card', () => {
        expect(getStaleLevel(card(), START + 99 * 60_000, 'completed')).toBe('fresh');
    });

    it('clamps a carried-over sullam to leaderboard start so it loads fresh', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [sulam({
                created_at: '2026-08-20T00:00:00Z',
                last_step_date: '2026-08-20T01:00:00Z',
                current_step: '11',
            })],
        })], START);
        const c = b['11'][0] as SullamCard;
        expect(c.staleClockStart).toBe(START);
        expect(getStaleLevel(c, START, '11')).toBe('fresh');
    });

    it('measures a zero-step sullam opened before the session from leaderboard start', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [sulam({ created_at: '2026-08-26T09:00:00Z' })],
        })], START);
        const c = b.new[0] as SullamCard;
        expect(c.staleClockStart).toBe(START);
        expect(getStaleLevel(c, START + 23 * 60_000, 'new')).toBe('red');
    });

    it('measures a zero-step sullam opened mid-session from when it was opened', () => {
        // Regression: clamping to leaderboard start alone made a sullam opened
        // minutes ago render red immediately.
        const openedAt = START + 70 * 60_000;
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [sulam({ created_at: new Date(openedAt).toISOString() })],
        })], START);
        const c = b.new[0] as SullamCard;
        expect(c.staleClockStart).toBe(openedAt);
        expect(getStaleLevel(c, openedAt + 5 * 60_000, 'new')).toBe('fresh');
        expect(getStaleLevel(c, openedAt + 16 * 60_000, 'new')).toBe('yellow');
    });

    it('still runs the open timer from created_at, not the clamped clock', () => {
        const b = buildBoard([row({
            QadeemStatus: true,
            NewSullamProgress: [sulam({ created_at: '2026-08-24T12:00:00Z' })],
        })], START);
        const c = b.new[0] as SullamCard;
        expect(formatDuration(START - (c.createdAt as number))).toBe('48:00:00');
    });
});

describe('parseApiDate', () => {
    const EXPECTED = Date.parse('2026-08-26T12:00:00Z');

    it('reads ISO strings from the scores endpoint', () => {
        expect(parseApiDate('2026-08-26T12:00:00Z')).toBe(EXPECTED);
    });

    it('reads MongoEngine extended JSON, where $date is a number', () => {
        // Regression: Date.parse only accepts strings, so this shape used to
        // yield NaN, zero out the staleness clock and paint the board red.
        expect(parseApiDate({ $date: EXPECTED })).toBe(EXPECTED);
        expect(parseApiDate({ $date: { $numberLong: String(EXPECTED) } })).toBe(EXPECTED);
    });

    it('accepts a bare epoch and rejects junk', () => {
        expect(parseApiDate(EXPECTED)).toBe(EXPECTED);
        expect(parseApiDate(null)).toBeNull();
        expect(parseApiDate(undefined)).toBeNull();
        expect(parseApiDate('not a date')).toBeNull();
        expect(parseApiDate({})).toBeNull();
    });
});
