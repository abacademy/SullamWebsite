import React from 'react';
import { Box, Text, Flex, HStack, VStack, Tooltip } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
    SummaryCard as SummaryCardData, SummaryTile,
    NEW_STEPS, ordinalRank, formatSulamLength, POINTS_PER_PAGE, COLUMN_THEME,
} from '../../utils/progressLeaderboard';
import FinishMarks from './FinishMarks';

const MotionBox = motion(Box);

const RANK_BG = ['yellow.200', 'gray.200', 'orange.200'] as const;
const RANK_FG = ['yellow.800', 'gray.700', 'orange.800'] as const;

type Props = {
    card: SummaryCardData;
    /** Fixed width for the horizontal (bottom-docked) layout; fills the column otherwise. */
    width?: string;
};

function StepStrip({ doneSteps }: { doneSteps: string[] }) {
    const done = new Set(doneSteps);
    return (
        <HStack spacing="2px" flex="1" minW={0}>
            {NEW_STEPS.map((step) => (
                <Box
                    key={step}
                    flex="1"
                    h="18px"
                    borderRadius="full"
                    bg={done.has(step) ? 'purple.500' : 'gray.200'}
                    color={done.has(step) ? 'white' : 'gray.500'}
                    fontSize="10px"
                    fontWeight="bold"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    lineHeight="1"
                >
                    {step}
                </Box>
            ))}
        </HStack>
    );
}

function NewTile({ tile }: { tile: SummaryTile }) {
    return (
        <HStack spacing={1.5}>
            <Text fontSize="xs" fontWeight="bold" color="purple.700" w="52px" flexShrink={0} noOfLines={1}>
                {formatSulamLength(tile.pages)}
            </Text>
            <StepStrip doneSteps={tile.steps} />
        </HStack>
    );
}

export default function SummaryCard({ card, width }: Props) {
    const medal = card.rank <= 3;
    // Tinted to the column the student is currently in, so the Summary reads
    // as a key to where everyone is on the board.
    const tint = COLUMN_THEME[card.stepColumn];

    return (
        <MotionBox
            layoutId={card.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            w={width}
            flexShrink={width ? 0 : undefined}
            px={2.5}
            py={2}
            bg={tint.bg}
            borderRadius="xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.16)"
            borderWidth="2px"
            borderColor={tint.ring}
            sx={{ transition: 'background-color 0.6s ease, border-color 0.6s ease' }}
        >
            {/* Rank, name and the headline total share one row. The total is
                TotalPoints in pages, as the default leaderboard shows it — and
                the figure this list is ranked by. */}
            <Flex align="center" gap={2}>
                <Box
                    px={1.5}
                    py="1px"
                    borderRadius="md"
                    bg={medal ? RANK_BG[card.rank - 1] : 'white'}
                    flexShrink={0}
                >
                    <Text
                        fontSize="sm"
                        fontWeight="extrabold"
                        color={medal ? RANK_FG[card.rank - 1] : 'gray.600'}
                        lineHeight="short"
                    >
                        {ordinalRank(card.rank)}
                    </Text>
                </Box>
                <Tooltip label={card.name} openDelay={400}>
                    <Text fontWeight="extrabold" fontSize="lg" noOfLines={1} lineHeight="1.2" flex="1" minW={0}>
                        {card.name}
                    </Text>
                </Tooltip>
                <Flex align="baseline" gap={1} flexShrink={0}>
                    <Text
                        fontSize="2xl"
                        fontWeight="extrabold"
                        lineHeight="1"
                        fontFamily="'Lexend', monospace"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {(card.totalPoints / POINTS_PER_PAGE).toFixed(1)}
                    </Text>
                    <Text fontSize="xs" fontWeight="bold" color="gray.500">pgs</Text>
                </Flex>
            </Flex>

            <Flex align="center" justify="space-between" gap={2} mt={1.5}>
                <Box px={2} py={0.5} borderRadius="md" bg="white" border="1px solid" borderColor="gray.200">
                    <Text fontSize="sm" color="gray.700" lineHeight="short" whiteSpace="nowrap">
                        <Box as="span" fontWeight="bold" color="gray.500">Qadeem </Box>
                        {card.qadeemPages.toFixed(1)} pgs
                    </Text>
                </Box>
                <FinishMarks count={card.finishedCount} star={card.qadeemStar} size={22} />
            </Flex>

            {card.newTiles.length > 0 && (
                <VStack align="stretch" spacing={1} mt={1.5}>
                    {card.newTiles.map((tile, i) => (
                        <NewTile key={`n${i}`} tile={tile} />
                    ))}
                </VStack>
            )}
        </MotionBox>
    );
}
