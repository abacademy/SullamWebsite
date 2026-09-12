import React from 'react';
import { Box, Text, Flex, HStack, VStack } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import {
    SummaryCard as SummaryCardData, SummaryTile,
    NEW_STEPS, ordinalRank, formatSulamLength,
} from '../../utils/progressLeaderboard';

const MotionBox = motion(Box);

const RANK_BG = ['yellow.200', 'gray.200', 'orange.200'] as const;
const RANK_FG = ['yellow.800', 'gray.700', 'orange.800'] as const;

type Props = { card: SummaryCardData };

function StepStrip({ doneSteps }: { doneSteps: string[] }) {
    const done = new Set(doneSteps);
    return (
        <HStack spacing="2px" w="100%">
            {NEW_STEPS.map((step) => (
                <Box
                    key={step}
                    flex="1"
                    h="18px"
                    borderRadius="full"
                    bg={done.has(step) ? 'purple.500' : 'gray.200'}
                    color={done.has(step) ? 'white' : 'gray.500'}
                    fontSize="9px"
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
        <Box px={1.5} py={1} bg="purple.50" borderRadius="md" border="1px solid" borderColor="purple.100">
            <Text fontSize="9px" fontWeight="bold" color="purple.700" textAlign="center" mb="3px" noOfLines={1}>
                {formatSulamLength(tile.pages)}
            </Text>
            <StepStrip doneSteps={tile.steps} />
        </Box>
    );
}

export default function SummaryCard({ card }: Props) {
    const medal = card.rank <= 3;
    return (
        <MotionBox
            layoutId={card.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            px={2}
            py={2}
            bg="white"
            borderRadius="xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.16)"
        >
            <Flex align="center" gap={1.5} mb={1.5}>
                <Box
                    px={1.5}
                    py="1px"
                    borderRadius="md"
                    bg={medal ? RANK_BG[card.rank - 1] : 'gray.100'}
                    flexShrink={0}
                >
                    <Text
                        fontSize="10px"
                        fontWeight="extrabold"
                        color={medal ? RANK_FG[card.rank - 1] : 'gray.600'}
                        lineHeight="short"
                    >
                        {ordinalRank(card.rank)}
                    </Text>
                </Box>
                <Text fontWeight="bold" fontSize="xs" noOfLines={1} lineHeight="short">
                    {card.name}
                </Text>
            </Flex>

            <Box
                px={1.5}
                py={0.5}
                mb={card.newTiles.length ? 1.5 : 0}
                borderRadius="md"
                border="1px solid"
                borderColor={card.qadeemStar ? 'green.400' : 'gray.200'}
                bg={card.qadeemStar ? 'green.50' : 'transparent'}
            >
                <Text fontSize="9px" fontWeight="bold" color="gray.500" textAlign="center" mb="1px">
                    Qadeem
                </Text>
                <Text fontSize="xs" color="gray.700" textAlign="center" lineHeight="short">
                    {card.qadeemPages.toFixed(1)} pgs
                    {card.qadeemStar && <Box as="span" color="#D4A017"> ✭</Box>}
                </Text>
            </Box>

            {card.newTiles.length > 0 && (
                <Box>
                    <Text fontSize="9px" fontWeight="bold" color="purple.600" textAlign="center" mb={1}>
                        New
                    </Text>
                    <VStack align="stretch" spacing={1}>
                        {card.newTiles.map((tile, i) => (
                            <NewTile key={`n${i}`} tile={tile} />
                        ))}
                    </VStack>
                </Box>
            )}
        </MotionBox>
    );
}
