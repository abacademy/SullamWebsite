// src/components/LazyAccordionPanel.tsx
import React, { useEffect, useState } from 'react';
import { AccordionPanel, AccordionPanelProps, useAccordionItemState } from '@chakra-ui/react';

// long enough for Chakra's collapse animation to finish
const CLOSE_ANIMATION_MS = 300;

interface Props extends Omit<AccordionPanelProps, 'children'> {
    children: () => React.ReactNode;
}

// Chakra keeps a collapsed AccordionPanel's children mounted (just hidden), so a
// tree holding every org's students renders thousands of rows nobody can see.
// This only builds the contents while the item is open.
export default function LazyAccordionPanel({ children, ...rest }: Props) {
    const { isOpen } = useAccordionItemState();
    const [mounted, setMounted] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            return;
        }
        // keep the contents around while the panel animates shut
        const timeout = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS);
        return () => clearTimeout(timeout);
    }, [isOpen]);

    return <AccordionPanel {...rest}>{isOpen || mounted ? children() : null}</AccordionPanel>;
}
