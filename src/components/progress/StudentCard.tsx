import React from 'react';
import { Box, Text, Flex, Tooltip } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { StudentCard as StudentCardData } from '../../utils/progressLeaderboard';

const MotionBox = motion(Box);

type Props = {
    card: StudentCardData;
};

/**
 * Every per-student card. Qadeem pairs pages done against pages assigned, with
 * the deduplicated range beneath the name; "Did not start" is just a name, since
 * it is a list of idle students rather than an achievement; Completed merges a
 * student's finished sullams into a single total.
 */
export default function StudentCard({ card }: Props) {
    const isQadeem = card.variant === 'qadeem';
    const isCompleted = card.variant === 'completed';

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
            bg="white"
            borderRadius="xl"
            boxShadow="0 1px 3px rgba(0,0,0,0.06)"
        >
            <Flex justify="space-between" align="center" gap={2}>
                <Box minW={0}>
                    <Tooltip label={card.name} openDelay={400}>
                        <Text fontWeight="bold" fontSize="sm" noOfLines={2} lineHeight="short">
                            {card.name}
                        </Text>
                    </Tooltip>
                    {isQadeem && card.rangePages != null && (
                        <Text fontSize="xs" color="gray.500" mt={0.5} whiteSpace="nowrap">
                            {card.rangePages.toFixed(1)} range
                        </Text>
                    )}
                </Box>

                {isCompleted && card.lines != null && (
                    <Text fontSize="sm" fontWeight="bold" color="green.600" flexShrink={0} whiteSpace="nowrap">
                        {card.lines.toFixed(1)} lines
                    </Text>
                )}

                {isQadeem && card.totalPages > 0 && (
                    <Text fontSize="sm" fontWeight="bold" flexShrink={0} whiteSpace="nowrap">
                        {card.donePages.toFixed(1)}
                        <Box as="span" color="gray.400" fontWeight="normal"> / </Box>
                        <Box as="span" color="blue.500">{card.totalPages.toFixed(1)}</Box>
                    </Text>
                )}
            </Flex>
        </MotionBox>
    );
}
