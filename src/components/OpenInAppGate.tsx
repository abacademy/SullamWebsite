// Shows before the rest of the site on iOS/Android: Open in app vs stay on web.
import React, { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Heading,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    VStack,
} from '@chakra-ui/react';
import {
    hasChosenStayInWebsite,
    isMobileDevice,
    openInApp,
    rememberStayInWebsite,
} from '../utils/openInApp';

interface Props {
    children: React.ReactNode;
}

export default function OpenInAppGate({ children }: Props) {
    const mobile = useMemo(() => isMobileDevice(), []);
    const [stay, setStay] = useState(() => !mobile || hasChosenStayInWebsite());

    if (stay) return <>{children}</>;

    return (
        <>
            {/* Block the site underneath until they choose */}
            <Box minH="100vh" bg="gray.50" />
            <Modal isOpen onClose={() => undefined} isCentered closeOnOverlayClick={false} closeOnEsc={false}>
                <ModalOverlay bg="blackAlpha.700" />
                <ModalContent mx={4} borderRadius="xl">
                    <ModalHeader pb={1}>
                        <Heading size="md">Open in Sullam Tracker?</Heading>
                    </ModalHeader>
                    <ModalBody>
                        <VStack align="stretch" spacing={3}>
                            <Text color="gray.600">
                                You're on a phone. Open this in the Sullam Tracker app for the best experience.
                            </Text>
                            <Text fontSize="sm" color="gray.500">
                                If the app isn't installed, your phone may show an error — you can stay on the website
                                instead.
                            </Text>
                        </VStack>
                    </ModalBody>
                    <ModalFooter gap={3} flexWrap="wrap">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                rememberStayInWebsite();
                                setStay(true);
                            }}
                        >
                            Stay on website
                        </Button>
                        <Button
                            colorScheme="accent"
                            onClick={() => {
                                openInApp();
                                // Keep the prompt available; they can still stay if the app didn't open.
                            }}
                        >
                            Yes, open app
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
