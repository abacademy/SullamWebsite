import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
    Box, Text, Flex, Heading, Grid, HStack, VStack, Spinner, IconButton, Tooltip,
    useToast,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Countdown from 'react-countdown';
import { ArrowBackIcon, ViewIcon, CopyIcon } from '@chakra-ui/icons';
import AuthGuard from '../components/AuthGuard';
import ProgressColumn from '../components/progress/ProgressColumn';
import ProgressBanner, { Banner } from '../components/progress/ProgressBanner';
import { BASE_URL } from '../constants/ApiConfig';
import {
    StudentRow, COLUMNS, REFRESH_INTERVAL, BANNER_DURATION_MS, MAX_BANNERS,
    buildBoard, resolveCurrentStep, parseApiDate, countToColumn, stepToColumn,
    COLUMN_LABEL, ColumnKey,
} from '../utils/progressLeaderboard';

type StepSnapshot = Record<string, ColumnKey>;
type QadeemSnapshot = Record<string, boolean>;

function ProgressLeaderboardPageContent() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState<StudentRow[]>([]);
    const [leaderboard, setLeaderboard] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [banners, setBanners] = useState<Banner[]>([]);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const nextRefreshAt = useRef(Date.now() + REFRESH_INTERVAL);
    const prevSteps = useRef<StepSnapshot | null>(null);
    const prevQadeem = useRef<QadeemSnapshot | null>(null);
    const bannerSeq = useRef(0);

    const toast = useToast();
    const token = localStorage.getItem('sulam_token') || '';

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

    // Show the head of the queue for its slot, then move on to the next.
    const currentBanner = banners[0] ?? null;
    useEffect(() => {
        if (!currentBanner) return;
        const t = setTimeout(() => {
            setBanners((prev) => prev.filter((x) => x.id !== currentBanner.id));
        }, BANNER_DURATION_MS);
        return () => clearTimeout(t);
    }, [currentBanner]);

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
            <ProgressBanner banner={currentBanner} />

            <Grid
                templateColumns={['1fr auto 1fr', null, '1fr auto 1fr']}
                alignItems="center"
                mb={3}
                gap={2}
                flexShrink={0}
            >
                <HStack>
                    <Tooltip label="Home">
                        <IconButton aria-label="Home" icon={<ArrowBackIcon />} onClick={() => navigate('/')} />
                    </Tooltip>
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

            <Grid
                flex="1"
                minH={0}
                overflowX="auto"
                templateColumns="repeat(8, minmax(150px, 1fr))"
                gap={3}
                pb={2}
                sx={{ scrollSnapType: 'x proximity' }}
            >
                {COLUMNS.map((column) => (
                    <ProgressColumn key={column} column={column} cards={board[column]} now={boardNow} />
                ))}
            </Grid>
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
