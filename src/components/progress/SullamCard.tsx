import React from 'react';
import { Box, Text, Flex, Tooltip } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
    SullamCard as SullamCardData, ColumnKey, StaleLevel,
    formatOpenFor, getStaleLevel, COLUMN_THEME, formatSulamLength,
} from '../../utils/progressLeaderboard';
import FinishMarks from './FinishMarks';

const MotionBox = motion(Box);

/**
 * Cards sit on a pale tinted panel, so staleness is carried by a ring and the
 * timer colour as well as the fill — a wash alone would be lost against the
 * cream and pink columns.
 */
const STALE_STYLES: Record<StaleLevel, { bg: string; ring: string; timer: string }> = {
    fresh: { bg: 'white', ring: 'transparent', timer: 'gray.800' },
    yellow: { bg: 'yellow.100', ring: 'yellow.400', timer: 'yellow.800' },
    red: { bg: 'red.100', ring: 'red.400', timer: 'red.700' },
};

type Props = {
    card: SullamCardData;
    column: ColumnKey;
    now: number;
};

export default function SullamCard({ card, column, now }: Props) {
    const level = getStaleLevel(card, now, column);
    const style = STALE_STYLES[level];
    const { accent } = COLUMN_THEME[column];
    // The running counter itself, so a sulam at 51 reads 51 rather than 44.
    const badge = column === 'completed' ? '🏆' : (card.step ?? 0);
    const openFor = card.createdAt != null ? formatOpenFor(now - card.createdAt) : '—';

    return (
        <MotionBox
            layoutId={card.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            px={3}
            py={2.5}
            bg={style.bg}
            borderRadius="xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.16)"
            borderWidth="2px"
            borderColor={style.ring}
            sx={{ transition: 'background-color 0.6s ease, border-color 0.6s ease' }}
            position="relative"
        >
            {/* Sits on the corner rather than inside it, so it never crowds
                the step number, and stays readable on a yellow or red card. */}
            <Flex position="absolute" top="-10px" right="-8px">
                <FinishMarks count={card.ownerFinishedCount} star={card.ownerQadeemStar} />
            </Flex>
            <Flex justify="space-between" align="flex-start" gap={2}>
                <Box minW={0}>
                    <Tooltip label={card.label ? `${card.name} · ${card.label}` : card.name} openDelay={400}>
                        <Text fontWeight="extrabold" fontSize="lg" noOfLines={2} lineHeight="1.15">
                            {card.name}
                        </Text>
                    </Tooltip>
                    <Text fontSize="sm" color="gray.500" mt={0.5}>
                        ({formatSulamLength(card.pages)})
                    </Text>
                    {card.startedFrom && (
                        <Text fontSize="sm" color="gray.500" mt={0.5} whiteSpace="nowrap">
                            Started from {card.startedFrom}
                        </Text>
                    )}
                </Box>
                <Text
                    fontSize="3xl"
                    fontWeight="extrabold"
                    color={accent}
                    lineHeight="1"
                    flexShrink={0}
                >
                    {badge}
                </Text>
            </Flex>

            <Text
                mt={2}
                textAlign="center"
                fontSize="2xl"
                fontWeight="bold"
                fontFamily="'Lexend', monospace"
                // Proportional digits make a per-second timer visibly jitter,
                // and there are dozens of these on screen at once.
                sx={{ fontVariantNumeric: 'tabular-nums' }}
                color={style.timer}
            >
                {openFor}
            </Text>
        </MotionBox>
    );
}
