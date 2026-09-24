import React, { useEffect, useRef } from 'react';
import { Box, Flex, Text, IconButton, Tooltip } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { SummaryCard as SummaryCardData, COLUMN_THEME, COLUMN_LABEL } from '../../utils/progressLeaderboard';
import SummaryCard from './SummaryCard';

export type SummaryDock = 'right' | 'bottom';

/** Ranks pinned outside the scroller, so the podium stays on screen however long the list gets. */
const PINNED = 3;
const HORIZONTAL_CARD_WIDTH = '280px';

// The scrollers are motion elements only so they can take `layoutScroll`:
// without it framer reads the auto-scroll offset as the cards having moved,
// and every re-render (the page ticks once a second) animates them back.
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

/** Auto-scroll speed through ranks 4+, and how long it rests at each end. */
const SCROLL_PX_PER_SEC = 30;
const SCROLL_PAUSE_MS = 4000;

/**
 * Slowly scrolls an overflowing list end to end, rests, jumps back to the top
 * and goes again — the board runs unattended on a display, so nobody is there
 * to scroll it. Holds still while hovered so someone can read or scroll by hand.
 */
function useAutoScroll(ref: React.RefObject<HTMLDivElement | null>, axis: 'x' | 'y') {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let raf = 0;
        let last = performance.now();
        const read = () => (axis === 'y' ? el.scrollTop : el.scrollLeft);
        // scrollTop only takes whole pixels, so carry the fraction ourselves
        // or a slow speed would never move at all.
        let pos = read();
        // What we last wrote. If the real position drifts from it, something
        // else moved the list (a hand scroll, scroll anchoring as cards come
        // and go) and we pick up from there instead of yanking it back.
        let written = pos;
        let pausedUntil = last + SCROLL_PAUSE_MS;
        let hovered = false;

        const onEnter = () => { hovered = true; };
        const onLeave = () => {
            hovered = false;
            pos = read();
            written = pos;
            pausedUntil = performance.now() + SCROLL_PAUSE_MS / 2;
        };
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);

        const tick = (t: number) => {
            const dt = t - last;
            last = t;
            const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
            if (!hovered && max > 0 && t >= pausedUntil) {
                if (Math.abs(read() - written) > 1) pos = read();
                if (pos >= max) {
                    // Rested at the end: back to the top, then rest there too.
                    pos = 0;
                    written = 0;
                    el.scrollTo({ [axis === 'y' ? 'top' : 'left']: 0, behavior: 'smooth' });
                    pausedUntil = t + SCROLL_PAUSE_MS;
                } else {
                    pos = Math.min(max, pos + (SCROLL_PX_PER_SEC * dt) / 1000);
                    if (axis === 'y') el.scrollTop = pos; else el.scrollLeft = pos;
                    written = read();
                    if (pos >= max) pausedUntil = t + SCROLL_PAUSE_MS;
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            el.removeEventListener('pointerenter', onEnter);
            el.removeEventListener('pointerleave', onLeave);
        };
    }, [ref, axis]);
}

/**
 * The auto-scroller has no visible bar: it drives itself, and hovering pauses
 * it so the wheel or trackpad still scrolls by hand. Chrome ignores the
 * ::-webkit-scrollbar rules once `scrollbar-color` is set, so the bar is
 * removed outright rather than made transparent.
 */
const AUTO_SCROLLBAR = {
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
};

type Props = {
    cards: SummaryCardData[];
    dock: SummaryDock;
    onToggleDock: () => void;
    /** Pointer handlers for the grip: dragging it to another edge re-docks the panel. */
    gripHandlers: React.HTMLAttributes<HTMLDivElement>;
};

export default function SummaryPanel({ cards, dock, onToggleDock, gripHandlers }: Props) {
    const { bg, accent } = COLUMN_THEME.completed;
    const horizontal = dock === 'bottom';
    const pinned = cards.slice(0, PINNED);
    const rest = cards.slice(PINNED);
    const cardWidth = horizontal ? HORIZONTAL_CARD_WIDTH : undefined;
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    useAutoScroll(scrollerRef, horizontal ? 'x' : 'y');

    const renderCards = (list: SummaryCardData[]) => list.map((card) => (
        <SummaryCard key={card.key} card={card} width={cardWidth} />
    ));

    return (
        <Flex
            direction="column"
            h="100%"
            w="100%"
            minH={0}
            minW={0}
            bg={bg}
            borderRadius="3xl"
            boxShadow="0 1px 4px rgba(0,0,0,0.05)"
            overflow="hidden"
        >
            <Flex px={3} pt={2} pb={2} align="center" justify="space-between" flexShrink={0} gap={2}>
                <Tooltip label="Drag to the right or bottom edge to move" openDelay={400}>
                    <Flex
                        {...gripHandlers}
                        align="center"
                        gap={2}
                        cursor="grab"
                        userSelect="none"
                        sx={{ touchAction: 'none' }}
                        _active={{ cursor: 'grabbing' }}
                    >
                        <Text color="gray.400" fontSize="lg" lineHeight="1">⠿</Text>
                        <Text fontSize="xl" fontWeight="extrabold" color={accent} lineHeight="short">
                            {COLUMN_LABEL.completed}
                        </Text>
                    </Flex>
                </Tooltip>
                <Flex align="center" gap={2}>
                    <Flex
                        bg="white"
                        color="gray.700"
                        borderRadius="full"
                        minW="24px"
                        h="24px"
                        px={1.5}
                        align="center"
                        justify="center"
                    >
                        <Text fontSize="xs" fontWeight="bold">{cards.length}</Text>
                    </Flex>
                    <Tooltip label={horizontal ? 'Dock on the right' : 'Dock along the bottom'}>
                        <IconButton
                            aria-label="Switch summary layout"
                            size="xs"
                            variant="ghost"
                            onClick={onToggleDock}
                            icon={<Text fontSize="md">{horizontal ? '⇥' : '⤓'}</Text>}
                        />
                    </Tooltip>
                </Flex>
            </Flex>

            {horizontal ? (
                <Flex flex="1" minH={0} overflowY="auto" overflowX="hidden" px={2.5} pb={3} pt={1} align="stretch" sx={AUTO_SCROLLBAR}>
                    {/* Stretch all the way down, so every card in the row takes
                        the tallest card's height — pinned or scrolling. */}
                    <Flex gap={2.5} flexShrink={0} align="stretch" pr={2.5} mr={2.5} borderRight="2px solid" borderColor="gray.300">
                        <AnimatePresence>{renderCards(pinned)}</AnimatePresence>
                    </Flex>
                    <MotionFlex ref={scrollerRef} layoutScroll gap={2.5} flex="1" minW={0} overflowX="auto" align="stretch" sx={AUTO_SCROLLBAR}>
                        <AnimatePresence>{renderCards(rest)}</AnimatePresence>
                    </MotionFlex>
                </Flex>
            ) : (
                <Flex direction="column" flex="1" minH={0}>
                    <Flex
                        direction="column"
                        gap={2.5}
                        flexShrink={0}
                        px={2.5}
                        pt={1}
                        pb={rest.length ? 2.5 : 3}
                        borderBottom={rest.length ? '2px solid' : undefined}
                        borderColor="gray.300"
                    >
                        <AnimatePresence>{renderCards(pinned)}</AnimatePresence>
                    </Flex>
                    {/* Always mounted (even when empty) so the auto-scroll hook
                        has a stable element to attach to. */}
                    <MotionBox
                        ref={scrollerRef}
                        layoutScroll
                        flex="1"
                        minH={0}
                        overflowY="auto"
                        px={2.5}
                        pt={rest.length ? 2.5 : 0}
                        pb={rest.length ? 3 : 0}
                        sx={AUTO_SCROLLBAR}
                    >
                        <Flex direction="column" gap={2.5}>
                            <AnimatePresence>{renderCards(rest)}</AnimatePresence>
                        </Flex>
                    </MotionBox>
                </Flex>
            )}
        </Flex>
    );
}
