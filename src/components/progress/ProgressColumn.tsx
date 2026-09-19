import React from 'react';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import {
    BoardCard, ColumnKey, COLUMN_THEME, COLUMN_LABEL,
} from '../../utils/progressLeaderboard';
import SullamCard from './SullamCard';
import StudentCard from './StudentCard';
import SummaryCard from './SummaryCard';

type Props = {
    column: ColumnKey;
    cards: BoardCard[];
    now: number;
};

export default function ProgressColumn({ column, cards, now }: Props) {
    const { bg, accent } = COLUMN_THEME[column];

    return (
        <Flex
            direction="column"
            minH={0}
            bg={bg}
            borderRadius="3xl"
            boxShadow="0 1px 4px rgba(0,0,0,0.05)"
            overflow="hidden"
            sx={{ scrollSnapAlign: 'start' }}
        >
            {/* Drawn straight onto the panel rather than as a solid bar, so the
                tint reads as one surface. Sticky keeps the count visible when
                the column overflows. */}
            <Flex
                position="sticky"
                top={0}
                zIndex={1}
                bg={bg}
                px={8}
                pt={2}
                pb={2}
                align="center"
                justify="center"
                flexShrink={0}
            >
                <Text
                    fontSize="xl"
                    fontWeight="extrabold"
                    color={accent}
                    lineHeight="short"
                    textAlign="center"
                    noOfLines={2}
                >
                    {COLUMN_LABEL[column]}
                </Text>
                <Flex
                    position="absolute"
                    right={3}
                    bg="white"
                    color="gray.700"
                    borderRadius="full"
                    minW="24px"
                    h="24px"
                    px={1.5}
                    align="center"
                    justify="center"
                    flexShrink={0}
                >
                    <Text fontSize="xs" fontWeight="bold">{cards.length}</Text>
                </Flex>
            </Flex>

            <Box
                flex="1"
                minH={0}
                overflowY="auto"
                px={2.5}
                // Room for the finished-sullam badge that overhangs the
                // top-right corner of a card; the scroller would clip it.
                pt={2}
                pb={3}
                sx={{
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.12)', borderRadius: '3px' },
                }}
            >
                <VStack align="stretch" spacing={2.5}>
                    <AnimatePresence>
                        {cards.map((card) =>
                            card.kind === 'sullam' ? (
                                <SullamCard key={card.key} card={card} column={column} now={now} />
                            ) : card.kind === 'summary' ? (
                                <SummaryCard key={card.key} card={card} />
                            ) : (
                                <StudentCard key={card.key} card={card} />
                            )
                        )}
                    </AnimatePresence>
                </VStack>
            </Box>
        </Flex>
    );
}
