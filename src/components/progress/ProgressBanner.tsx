import React, { useMemo } from 'react';
import { Box, Text, VStack, HStack } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionBox = motion(Box);

export type Banner = {
    id: string;
    icon: string;
    message: string;
};

const CONFETTI_COLORS = ['#FFD166', '#06D6A0', '#EF476F', '#FF9F1C', '#A78BFA', '#4CC9F0'];
const CONFETTI_PIECES = 18;

/**
 * A one-shot burst behind a banner.
 *
 * Pieces are derived from the banner's sequence number rather than Math.random
 * so a re-render mid-flight cannot reshuffle them into a new arrangement.
 */
function Confetti({ seed }: { seed: number }) {
    const pieces = useMemo(
        () => Array.from({ length: CONFETTI_PIECES }, (_, i) => {
            const angle = (Math.PI * 2 * i) / CONFETTI_PIECES + (seed % 9) * 0.11;
            const distance = 70 + ((seed * 13 + i * 29) % 55);
            return {
                id: i,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                color: CONFETTI_COLORS[(i + seed) % CONFETTI_COLORS.length],
                rotate: 180 + ((seed * 7 + i * 53) % 360),
                delay: (i % 5) * 0.025,
            };
        }),
        [seed],
    );

    return (
        <Box position="absolute" left="50%" top="50%" w={0} h={0} zIndex={-1}>
            {pieces.map((p) => (
                <MotionBox
                    key={p.id}
                    position="absolute"
                    w="9px"
                    h="12px"
                    bg={p.color}
                    borderRadius="2px"
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                    // Drifts down as it flies out, so it reads as falling rather
                    // than a flat radial pop.
                    animate={{ x: p.x, y: p.y + 70, opacity: 0, rotate: p.rotate, scale: 0.5 }}
                    transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
                />
            ))}
        </Box>
    );
}

type Props = {
    banners: Banner[];
};

/**
 * A centred, self-limiting banner stack.
 *
 * Deliberately not Chakra's `useToast`: events here arrive in bursts on each
 * poll, and a stack of full-width toasts would cover the columns the board
 * exists to show.
 *
 * Anchored level with the tops of the columns rather than at the very top —
 * centred any higher it sits on the leaderboard name and countdown.
 */
export default function ProgressBanner({ banners }: Props) {
    return (
        <Box
            position="fixed"
            top="140px"
            left="50%"
            transform="translateX(-50%)"
            zIndex={1400}
            pointerEvents="none"
        >
            <VStack spacing={3}>
                <AnimatePresence>
                    {banners.map((banner) => (
                        <MotionBox
                            key={banner.id}
                            layout
                            position="relative"
                            initial={{ opacity: 0, y: -24, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -24, scale: 0.9 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            bg="blue.500"
                            color="white"
                            px={7}
                            py={4}
                            borderRadius="full"
                            boxShadow="0 10px 25px rgba(49,130,206,0.45)"
                        >
                            <Confetti seed={parseInt(banner.id.replace(/\D/g, ''), 10) || 0} />
                            <HStack spacing={3}>
                                <Text fontSize="2xl" lineHeight="1">{banner.icon}</Text>
                                <Text fontSize="xl" fontWeight="bold" whiteSpace="nowrap">
                                    {banner.message}
                                </Text>
                            </HStack>
                        </MotionBox>
                    ))}
                </AnimatePresence>
            </VStack>
        </Box>
    );
}
