import React, { useMemo, useRef } from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionBox = motion(Box);

export type Banner = {
    id: string;
    icon: string;
    message: string;
};

const CONFETTI_COLORS = ['#FFD166', '#06D6A0', '#EF476F', '#FF9F1C', '#A78BFA', '#4CC9F0'];
const CONFETTI_PIECES = 36;
/** The card, its icon and its message: the banner has arrived once all three settle. */
const ENTRANCE_PARTS = 3;

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
            const distance = 260 + ((seed * 13 + i * 29) % 220);
            return {
                id: i,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                color: CONFETTI_COLORS[(i + seed) % CONFETTI_COLORS.length],
                rotate: 180 + ((seed * 7 + i * 53) % 360),
                delay: 0.25 + (i % 5) * 0.03,
            };
        }),
        [seed],
    );

    return (
        <Box position="absolute" left="50%" top="50%" w={0} h={0}>
            {pieces.map((p) => (
                <MotionBox
                    key={p.id}
                    position="absolute"
                    w="16px"
                    h="22px"
                    bg={p.color}
                    borderRadius="3px"
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                    // Drifts down as it flies out, so it reads as falling rather
                    // than a flat radial pop.
                    animate={{ x: p.x, y: p.y + 160, opacity: 0, rotate: p.rotate, scale: 0.5 }}
                    transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
                />
            ))}
        </Box>
    );
}

type Props = {
    /** The announcement on screen, or null. The page feeds these one at a time. */
    banner: Banner | null;
    /** Called with the banner's id once its entrance animation has finished. */
    onEntered: (id: string) => void;
};

/**
 * A near-full-screen announcement.
 *
 * Deliberately not Chakra's `useToast`: this board is shown on a display across
 * the room, so an event has to be readable from the back. That size means only
 * one fits at a time — the page queues them and hands over the head.
 */
export default function ProgressBanner({ banner, onEntered }: Props) {
    // Counts settled entrance parts for the banner on screen. Keyed by id so
    // the card's exit animation completing doesn't count towards the next one.
    const settled = useRef({ id: '', count: 0 });
    const partDone = () => {
        if (!banner) return;
        if (settled.current.id !== banner.id) settled.current = { id: banner.id, count: 0 };
        if (++settled.current.count === ENTRANCE_PARTS) onEntered(banner.id);
    };

    return (
        // Let one banner finish leaving before the next arrives, rather than
        // cross-fading two full-screen panels over each other.
        <AnimatePresence exitBeforeEnter>
            {banner && (
                <MotionBox
                    key={banner.id}
                    position="fixed"
                    inset={0}
                    zIndex={1400}
                    pointerEvents="none"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg="rgba(15, 23, 42, 0.45)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.15 } }}
                    transition={{ duration: 0.3 }}
                >
                    <MotionBox
                        position="relative"
                        w="75vw"
                        h="75vh"
                        bg="blue.500"
                        color="white"
                        borderRadius="3xl"
                        boxShadow="0 30px 80px rgba(49,130,206,0.55)"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        overflow="hidden"
                        initial={{ opacity: 0, scale: 0.6, y: 80 }}
                        animate={{
                            opacity: 1, scale: 1, y: 0,
                            transition: { type: 'spring', stiffness: 260, damping: 22 },
                        }}
                        onAnimationComplete={partDone}
                        exit={{
                            opacity: 0, scale: 0.85, y: -60,
                            transition: { duration: 0.4, ease: 'easeIn' },
                        }}
                    >
                        <Confetti seed={parseInt(banner.id.replace(/\D/g, ''), 10) || 0} />
                        <VStack spacing={6} px={10} position="relative">
                            <MotionBox
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 }}
                                onAnimationComplete={partDone}
                            >
                                <Text fontSize="min(18vh, 14vw)" lineHeight="1">{banner.icon}</Text>
                            </MotionBox>
                            <MotionBox
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.25, ease: 'easeOut' }}
                                onAnimationComplete={partDone}
                            >
                                <Text
                                    fontSize="min(8vh, 5.5vw)"
                                    fontWeight="extrabold"
                                    textAlign="center"
                                    lineHeight="1.15"
                                >
                                    {banner.message}
                                </Text>
                            </MotionBox>
                        </VStack>
                    </MotionBox>
                </MotionBox>
            )}
        </AnimatePresence>
    );
}
