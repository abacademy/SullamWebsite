import React from 'react';
import { Flex, HStack, Tooltip } from '@chakra-ui/react';

/** Past this many, the checkmarks collapse into one "✓×N" pill so they never crowd a card. */
const MAX_CHECKS = 3;

type Props = {
    /** Sullams taken to 55 this session. */
    count: number;
    /** Qadeem star earned today. */
    star: boolean;
    size?: number;
};

function Mark({ children, bg, size, label, wide }: {
    children: React.ReactNode; bg: string; size: number; label: string; wide?: boolean;
}) {
    return (
        <Tooltip label={label} openDelay={400}>
            <Flex
                minW={`${size}px`}
                h={`${size}px`}
                px={wide ? 1.5 : 0}
                borderRadius="full"
                bg={bg}
                color="white"
                fontSize={`${Math.round(size * 0.55)}px`}
                fontWeight="extrabold"
                align="center"
                justify="center"
                border="2px solid white"
                boxShadow="0 1px 4px rgba(0,0,0,0.25)"
                lineHeight="1"
                whiteSpace="nowrap"
            >
                {children}
            </Flex>
        </Tooltip>
    );
}

/** One ✓ per sullam finished this session, then the qadeem star. Renders nothing if neither applies. */
export default function FinishMarks({ count, star, size = 24 }: Props) {
    if (count <= 0 && !star) return null;
    const label = count === 1 ? 'Finished a sullam this session' : `Finished ${count} sullams this session`;

    return (
        <HStack spacing="-4px" flexShrink={0}>
            {count > MAX_CHECKS ? (
                <Mark bg="green.500" size={size} label={label} wide>✓×{count}</Mark>
            ) : (
                Array.from({ length: count }, (_, i) => (
                    <Mark key={i} bg="green.500" size={size} label={label}>✓</Mark>
                ))
            )}
            {star && (
                <Mark bg="#D4A017" size={size} label="Qadeem done today">★</Mark>
            )}
        </HStack>
    );
}
