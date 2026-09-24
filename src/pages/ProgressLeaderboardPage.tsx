import React, { useEffect, useState, useRef, useMemo, useCallback, useContext } from 'react';
import {
    Box, Text, Flex, Heading, Grid, HStack, VStack, Spinner, IconButton, Tooltip,
    useToast,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Countdown from 'react-countdown';
import { ArrowBackIcon, ViewIcon, CopyIcon, EditIcon } from '@chakra-ui/icons';
import { UserContext } from '../utils/UserContext';
import LeaderboardModal from '../components/LeaderboardModal';
import AuthGuard from '../components/AuthGuard';
import ProgressColumn from '../components/progress/ProgressColumn';
import ProgressBanner, { Banner } from '../components/progress/ProgressBanner';
import SummaryPanel, { SummaryDock } from '../components/progress/SummaryPanel';
import { BASE_URL } from '../constants/ApiConfig';
import {
    StudentRow, COLUMNS, REFRESH_INTERVAL, BANNER_HOLD_MS, MAX_BANNERS,
    buildBoard, resolveCurrentStep, parseApiDate, countToColumn, stepToColumn,
    COLUMN_LABEL, ColumnKey, SummaryCard,
} from '../utils/progressLeaderboard';

type StepSnapshot = Record<string, ColumnKey>;
type QadeemSnapshot = Record<string, boolean>;

const LADDER_COLUMNS = COLUMNS.filter((c) => c !== 'completed');

// The summary's placement is a per-screen preference, so it lives in this
// browser only. Storage can throw (private mode), hence the guards.
const DOCK_KEY = 'progressSummaryDock';
const SIZE_KEY = 'progressSummarySize';
const DEFAULT_SIZE: Record<SummaryDock, number> = { right: 340, bottom: 260 };
const MIN_SIZE: Record<SummaryDock, number> = { right: 260, bottom: 160 };
/** The ladder always keeps at least this share of the board. */
const MAX_SHARE = 0.6;

function readStored<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : (JSON.parse(raw).value ?? fallback);
    } catch {
        return fallback;
    }
}

function writeStored(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify({ value }));
    } catch {
        // Not worth surfacing: the layout just won't persist.
    }
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
    return (
        <HStack spacing={1.5}>
            {swatch}
            <Text fontSize="xs" color="gray.600" lineHeight="short">{children}</Text>
        </HStack>
    );
}

function Swatch({ bg, ring }: { bg: string; ring: string }) {
    return <Box w="14px" h="14px" borderRadius="sm" bg={bg} border="2px solid" borderColor={ring} flexShrink={0} />;
}

function Legend() {
    return (
        <VStack align="start" spacing={0.5}>
            <LegendItem swatch={<Swatch bg="yellow.100" ring="yellow.400" />}>
                Taking long
            </LegendItem>
            <LegendItem swatch={<Swatch bg="red.100" ring="red.400" />}>
                Taking too long
            </LegendItem>
            <LegendItem swatch={<Text fontSize="xs" color="green.500" fontWeight="extrabold" w="14px" textAlign="center">✓</Text>}>
                Finished a sullam
            </LegendItem>
            <LegendItem swatch={<Text fontSize="xs" color="#D4A017" w="14px" textAlign="center">★</Text>}>
                Qadeem done today
            </LegendItem>
        </VStack>
    );
}

function ProgressLeaderboardPageContent() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);

    const [data, setData] = useState<StudentRow[]>([]);
    const [leaderboard, setLeaderboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [banners, setBanners] = useState<Banner[]>([]);
    /** The banner whose entrance animation has finished; its hold starts then. */
    const [enteredBannerId, setEnteredBannerId] = useState<string | null>(null);
    const [showEdit, setShowEdit] = useState(false);

    const [dock, setDockState] = useState<SummaryDock>(() => {
        const v = readStored<SummaryDock>(DOCK_KEY, 'right');
        return v === 'bottom' ? 'bottom' : 'right';
    });
    const [sizes, setSizes] = useState<Record<SummaryDock, number>>(
        () => ({ ...DEFAULT_SIZE, ...readStored(SIZE_KEY, DEFAULT_SIZE) }),
    );
    /** Where the summary would land if the drag ended now; null when not dragging. */
    const [dropTarget, setDropTarget] = useState<SummaryDock | null>(null);
    const boardRef = useRef<HTMLDivElement | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const nextRefreshAt = useRef(Date.now() + REFRESH_INTERVAL);
    const prevSteps = useRef<StepSnapshot | null>(null);
    const prevQadeem = useRef<QadeemSnapshot | null>(null);
    const bannerSeq = useRef(0);

    const toast = useToast();
    const token = localStorage.getItem('sulam_token') || '';

    const setDock = (next: SummaryDock) => {
        setDockState(next);
        writeStored(DOCK_KEY, next);
    };

    const clampSize = (which: SummaryDock, px: number) => {
        const rect = boardRef.current?.getBoundingClientRect();
        const span = rect ? (which === 'right' ? rect.width : rect.height) : Infinity;
        return Math.round(Math.max(MIN_SIZE[which], Math.min(px, span * MAX_SHARE)));
    };

    // Dragging the divider resizes the panel. Pointer capture keeps the moves
    // coming even when the cursor outruns the thin handle.
    const resizeHandlers: React.HTMLAttributes<HTMLDivElement> = {
        onPointerDown: (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
        },
        onPointerMove: (e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const rect = boardRef.current?.getBoundingClientRect();
            if (!rect) return;
            const px = dock === 'right' ? rect.right - e.clientX : rect.bottom - e.clientY;
            setSizes((prev) => ({ ...prev, [dock]: clampSize(dock, px) }));
        },
        onPointerUp: (e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setSizes((prev) => {
                writeStored(SIZE_KEY, prev);
                return prev;
            });
        },
    };

    // Dragging the panel's grip re-docks it to whichever edge the pointer is
    // nearer, relative to the board's size.
    const nearestEdge = (x: number, y: number): SummaryDock | null => {
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const fromRight = (rect.right - x) / rect.width;
        const fromBottom = (rect.bottom - y) / rect.height;
        return fromBottom < fromRight ? 'bottom' : 'right';
    };

    const gripHandlers: React.HTMLAttributes<HTMLDivElement> = {
        onPointerDown: (e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
            setDropTarget(dock);
        },
        onPointerMove: (e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            setDropTarget(nearestEdge(e.clientX, e.clientY));
        },
        onPointerUp: (e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            const target = nearestEdge(e.clientX, e.clientY);
            if (target && target !== dock) setDock(target);
            setDropTarget(null);
        },
        onPointerCancel: () => setDropTarget(null),
    };

    // Same rule as the default view: teachers and admins of any org on the board.
    const canEditLeaderboard = () => {
        if (!user || !leaderboard) return false;
        const roles = new Set(['teacher', 'rabtteacher', 'admin']);
        const orgs: string[] = Array.isArray(leaderboard.student_organizations) ? leaderboard.student_organizations : [];
        return orgs.some((org) => roles.has(user.organizations?.[org]?.role));
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast({ status: 'success', title: 'Link copied' });
        } catch {
            toast({ status: 'error', title: 'Failed to copy' });
        }
    };

    const pushBanners = useCallback((incoming: Omit<Banner, 'id'>[]) => {
        if (!incoming.length) return;
        const withIds = incoming.map((b) => ({ ...b, id: `b${bannerSeq.current++}` }));
        // Banners play one at a time, so cap the queue or a burst of
        // confirmations would keep the board covered for minutes. The one on
        // screen is kept; the oldest waiting ones drop out first.
        setBanners((prev) => {
            const next = [...prev, ...withIds];
            if (next.length <= MAX_BANNERS) return next;
            return [next[0], ...next.slice(-(MAX_BANNERS - 1))];
        });
    }, []);

    // Show the head of the queue until it has finished arriving plus its hold,
    // then move on to the next.
    const currentBanner = banners[0] ?? null;
    useEffect(() => {
        if (!currentBanner || enteredBannerId !== currentBanner.id) return;
        const t = setTimeout(() => {
            setBanners((prev) => prev.filter((x) => x.id !== currentBanner.id));
        }, BANNER_HOLD_MS);
        return () => clearTimeout(t);
    }, [currentBanner, enteredBannerId]);

    /** Diff this poll against the last one and announce what moved. */
    const detectChanges = useCallback((rows: StudentRow[]) => {
        const steps: StepSnapshot = {};
        const qadeem: QadeemSnapshot = {};

        rows.forEach((row) => {
            (row.NewSullamProgress || []).forEach((item, i) => {
                const key = `${item.sulam_id ?? `${row.user_id}-${i}`}:${item.entry_index ?? i}`;
                // Track the column, not the raw counter: a banner per increment
                // would fire constantly, and the ask was to announce moves.
                steps[key] = item.count == null
                    ? stepToColumn(resolveCurrentStep(item))
                    : countToColumn(item.count);
            });
            qadeem[row.user_id] = row.QadeemStatus === true;
        });

        // First successful load establishes the baseline only — otherwise every
        // card on the board would announce itself at once.
        if (prevSteps.current === null || prevQadeem.current === null) {
            prevSteps.current = steps;
            prevQadeem.current = qadeem;
            return;
        }

        const events: Omit<Banner, 'id'>[] = [];
        const nameFor: Record<string, string> = {};
        rows.forEach((row) => {
            (row.NewSullamProgress || []).forEach((item, i) => {
                const key = `${item.sulam_id ?? `${row.user_id}-${i}`}:${item.entry_index ?? i}`;
                nameFor[key] = row.full_name;
            });
        });

        Object.entries(steps).forEach(([key, column]) => {
            const before = prevSteps.current?.[key];
            if (before === undefined || before === column) return;
            const name = nameFor[key] || 'Student';
            events.push(
                column === 'completed'
                    ? { icon: '✅', message: `${name} completed a sullam` }
                    : { icon: '⬆️', message: `${name} → ${COLUMN_LABEL[column]}` }
            );
        });

        Object.entries(qadeem).forEach(([userId, done]) => {
            if (done && prevQadeem.current?.[userId] === false) {
                const row = rows.find((r) => r.user_id === userId);
                events.push({ icon: '⭐', message: `${row?.full_name || 'Student'} finished qadeem` });
            }
        });

        prevSteps.current = steps;
        prevQadeem.current = qadeem;
        pushBanners(events);
    }, [pushBanners]);

    const fetchData = useCallback(async () => {
        nextRefreshAt.current = Date.now() + REFRESH_INTERVAL;
        try {
            const headers = { headers: { Authorization: token } };
            const [scoresRes, metaRes] = await Promise.all([
                axios.get(`${BASE_URL}/leaderboard/${id}?detailed_progress=true`, headers),
                axios.get(`${BASE_URL}/leaderboard/get/${id}`, headers),
            ]);

            if (!metaRes.data) {
                setFailed(true);
                setLoading(false);
                return;
            }

            setLeaderboard(metaRes.data);
            const rows: StudentRow[] = Array.isArray(scoresRes.data) ? scoresRes.data : [];
            detectChanges(rows);
            setData(rows);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load progress leaderboard:', err);
            // Only a failed *first* load blanks the board. Later failures keep the
            // last good data on screen so a flaky network can't wipe a display.
            setLoading((wasLoading) => {
                if (wasLoading) setFailed(true);
                return false;
            });
        }
    }, [id, token, detectChanges]);

    useEffect(() => {
        if (!id) return;
        fetchData();
        intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [id, fetchData]);

    // One ticker drives every live timer on the board.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // Falling back to 0 here would date every staleness clock from 1970 and
    // paint the whole board red, so an unparseable start is treated as "now".
    const startMs = useMemo(
        () => parseApiDate(leaderboard?.start_time) ?? Date.now(),
        [leaderboard],
    );

    const board = useMemo(() => buildBoard(data, startMs), [data, startMs]);

    const endTime = useMemo(() => {
        const ms = parseApiDate(leaderboard?.end_time);
        return ms == null ? null : new Date(ms);
    }, [leaderboard]);

    // Once the session is over the board is a record of how it ended: card
    // timers and staleness colours freeze at the end time rather than carrying
    // on (a card going yellow to red after everyone has left).
    const boardNow = endTime ? Math.min(now, endTime.getTime()) : now;

    const refreshRemaining = Math.max(0, Math.ceil((nextRefreshAt.current - now) / 1000));
    const refreshLabel = `${Math.floor(refreshRemaining / 60)}:${String(refreshRemaining % 60).padStart(2, '0')}`;

    const countdownRenderer = ({ days, hours, minutes, seconds }: any) => (
        <Text
            fontSize="5xl"
            fontWeight="bold"
            textAlign="center"
            mb={1}
            fontFamily="'Lexend', monospace"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
            {days > 0 ? `${days}d, ` : ''}
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Text>
    );

    if (loading) {
        return <Flex justify="center" align="center" minH="100vh"><Spinner size="xl" /></Flex>;
    }

    if (failed || !leaderboard) {
        return (
            <Flex justify="center" align="center" minH="100vh">
                <Text>Leaderboard not found or access denied.</Text>
            </Flex>
        );
    }

    return (
        <Box h="100vh" display="flex" flexDirection="column" overflow="hidden" p={4} bg="#E8EAF1">
            <ProgressBanner banner={currentBanner} onEntered={setEnteredBannerId} />

            <Grid
                templateColumns={['1fr auto 1fr', null, '1fr auto 1fr']}
                alignItems="center"
                mb={3}
                gap={2}
                flexShrink={0}
            >
                <HStack spacing={4} align="center">
                    <Tooltip label="Home">
                        <IconButton aria-label="Home" icon={<ArrowBackIcon />} onClick={() => navigate('/')} />
                    </Tooltip>
                    <Legend />
                </HStack>

                <VStack spacing={0}>
                    <Heading size="lg" textAlign="center">{leaderboard.name}</Heading>
                    {endTime ? (
                        <Countdown date={endTime} renderer={countdownRenderer} />
                    ) : (
                        <Text fontSize="xl" color="red.500">Invalid end time</Text>
                    )}
                </VStack>

                <VStack justifySelf="end" align="end" spacing={1}>
                    <HStack>
                        {canEditLeaderboard() && (
                            <Tooltip label="Edit leaderboard">
                                <IconButton aria-label="Edit" icon={<EditIcon />} onClick={() => setShowEdit(true)} />
                            </Tooltip>
                        )}
                        <Tooltip label="Copy link">
                            <IconButton aria-label="Copy link" icon={<CopyIcon />} onClick={handleCopyLink} />
                        </Tooltip>
                        <Tooltip label="Default view">
                            <IconButton
                                aria-label="Default view"
                                icon={<ViewIcon />}
                                onClick={() => navigate(`/leaderboard/${id}`)}
                            />
                        </Tooltip>
                    </HStack>
                    <Text
                        fontSize="10px"
                        color="gray.500"
                        opacity={0.4}
                        fontFamily="mono"
                        lineHeight="1"
                        userSelect="none"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {refreshLabel}
                    </Text>
                </VStack>
            </Grid>

            <Flex
                ref={boardRef}
                flex="1"
                minH={0}
                direction={dock === 'right' ? 'row' : 'column'}
                position="relative"
            >
                <Grid
                    flex="1"
                    minH={0}
                    minW={0}
                    overflowX="auto"
                    templateColumns={`repeat(${LADDER_COLUMNS.length}, minmax(180px, 1fr))`}
                    gap={3}
                    pb={2}
                    sx={{ scrollSnapType: 'x proximity' }}
                >
                    {LADDER_COLUMNS.map((column) => (
                        <ProgressColumn key={column} column={column} cards={board[column]} now={boardNow} />
                    ))}
                </Grid>

                <Tooltip label="Drag to resize" openDelay={600}>
                    <Flex
                        {...resizeHandlers}
                        flexShrink={0}
                        align="center"
                        justify="center"
                        cursor={dock === 'right' ? 'col-resize' : 'row-resize'}
                        sx={{ touchAction: 'none' }}
                        role="separator"
                        aria-orientation={dock === 'right' ? 'vertical' : 'horizontal'}
                        {...(dock === 'right' ? { w: '12px' } : { h: '12px' })}
                        _hover={{ '& > div': { bg: 'gray.400' } }}
                    >
                        <Box
                            borderRadius="full"
                            bg="gray.300"
                            {...(dock === 'right' ? { w: '4px', h: '48px' } : { h: '4px', w: '48px' })}
                        />
                    </Flex>
                </Tooltip>

                <Box
                    flexShrink={0}
                    minH={0}
                    {...(dock === 'right'
                        ? { w: `${sizes.right}px`, pb: 2 }
                        : { h: `${sizes.bottom}px` })}
                >
                    <SummaryPanel
                        cards={board.completed as SummaryCard[]}
                        dock={dock}
                        onToggleDock={() => setDock(dock === 'right' ? 'bottom' : 'right')}
                        gripHandlers={gripHandlers}
                    />
                </Box>

                {dropTarget && (
                    // Preview of where the panel lands, drawn over the board.
                    <Flex
                        position="absolute"
                        zIndex={10}
                        pointerEvents="none"
                        align="center"
                        justify="center"
                        bg="rgba(49,130,206,0.18)"
                        border="3px dashed"
                        borderColor="blue.400"
                        borderRadius="3xl"
                        {...(dropTarget === 'right'
                            ? { top: 0, right: 0, bottom: 0, w: `${sizes.right}px` }
                            : { left: 0, right: 0, bottom: 0, h: `${sizes.bottom}px` })}
                    >
                        <Text fontWeight="extrabold" color="blue.600" fontSize="lg">
                            {dropTarget === 'right' ? 'Dock on the right' : 'Dock along the bottom'}
                        </Text>
                    </Flex>
                )}
            </Flex>

            {showEdit && (
                <LeaderboardModal
                    isOpen
                    mode="edit"
                    existing={leaderboard}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => {
                        setShowEdit(false);
                        fetchData();
                    }}
                />
            )}
        </Box>
    );
}

export default function ProgressLeaderboardPage() {
    return (
        <AuthGuard>
            <ProgressLeaderboardPageContent />
        </AuthGuard>
    );
}
