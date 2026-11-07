// src/pages/ZikrSessionPage.tsx
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Alert,
    AlertIcon,
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    Progress,
    SimpleGrid,
    Spinner,
    Table,
    Tag,
    Tbody,
    Td,
    Text,
    Tr,
    VStack,
    useToast,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { ArrowBackIcon, HamburgerIcon } from '@chakra-ui/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { UserContext } from '../utils/UserContext';
import { MAX_STEP, POLL_MS, STEPS, ZikrDetail, applyTap, errorMessage, parseAmount, zikrApi } from '../utils/zikr';

const pendingPulse = keyframes`
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
`;

const arriveFromCloud = keyframes`
    0% { opacity: 0; transform: translateY(0.6rem) scale(0.8); }
    18% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-2.25rem) scale(1); }
`;

type FloatTap = { id: number; amount: number; drift: number; phase: 'pending' | 'done' };

export function ZikrSessionContent() {
    const { id = '' } = useParams();
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const toast = useToast();

    const [session, setSession] = useState<ZikrDetail | null>(null);
    const [missing, setMissing] = useState(false);
    const [custom, setCustom] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [floats, setFloats] = useState<FloatTap[]>([]);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const floatSeq = useRef(0);
    const floatTimers = useRef<number[]>([]);

    // Taps update the screen at once; server reads are only applied when no tap
    // is in flight and none happened since the read started.
    const current = useRef<ZikrDetail | null>(null);
    const lastTotal = useRef<number | null>(null);
    const inFlight = useRef(0);
    const version = useRef(0);

    useEffect(
        () => () => {
            floatTimers.current.forEach((t) => window.clearTimeout(t));
        },
        []
    );

    const removeFloat = (floatId: number) => {
        setFloats((prev) => prev.filter((f) => f.id !== floatId));
    };

    const beginFloat = (amount: number) => {
        const floatId = ++floatSeq.current;
        const drift = ((floatId % 5) - 2) * 10;
        setFloats((prev) => [...prev, { id: floatId, amount, drift, phase: 'pending' }]);
        return floatId;
    };

    const scheduleFloatCleanup = (floatId: number, ms = 900) => {
        const timer = window.setTimeout(() => {
            removeFloat(floatId);
            floatTimers.current = floatTimers.current.filter((t) => t !== timer);
        }, ms);
        floatTimers.current.push(timer);
    };

    const resolveFloat = (floatId: number) => {
        setFloats((prev) => prev.map((f) => (f.id === floatId ? { ...f, phase: 'done' } : f)));
        scheduleFloatCleanup(floatId);
    };

    /** Remote / poll updates skip the pending spinner and just float the delta. */
    const spawnRemoteFloat = (amount: number) => {
        if (amount === 0) return;
        const floatId = ++floatSeq.current;
        const drift = ((floatId % 5) - 2) * 10;
        setFloats((prev) => [...prev, { id: floatId, amount, drift, phase: 'done' }]);
        scheduleFloatCleanup(floatId);
    };

    const show = (s: ZikrDetail, opts?: { fromTap?: boolean }) => {
        const prevTotal = lastTotal.current;
        current.current = s;
        lastTotal.current = s.total;
        setSession(s);
        if (!opts?.fromTap && prevTotal !== null && s.total !== prevTotal) {
            spawnRemoteFloat(s.total - prevTotal);
        }
    };

    const refresh = useCallback(async () => {
        const v = version.current;
        try {
            const data = await zikrApi.get(id);
            if (inFlight.current === 0 && v === version.current) show(data);
        } catch (e: any) {
            if (e?.response?.status === 404) setMissing(true);
        }
    }, [id]);

    useEffect(() => {
        refresh();
        const timer = setInterval(() => {
            if (!document.hidden && inFlight.current === 0) refresh();
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    const tap = (amount: number) => {
        const s = current.current;
        if (!s || s.closed) return;
        const [next, applied] = applyTap(s, amount, user?.full_name || 'You');
        if (applied === 0) return;
        version.current += 1;
        inFlight.current += 1;
        show(next, { fromTap: true });
        const floatId = beginFloat(applied);
        zikrApi
            .count(id, applied)
            .then(() => resolveFloat(floatId))
            .catch((e) => {
                removeFloat(floatId);
                toast({ status: 'error', title: errorMessage(e, 'That count did not save') });
            })
            .finally(() => {
                inFlight.current -= 1;
                if (inFlight.current === 0) refresh();
            });
    };

    const tapCustom = (sign: 1 | -1) => {
        const n = parseAmount(custom);
        if (n === null) {
            toast({ status: 'warning', title: `Enter a whole number from 1 to ${MAX_STEP.toLocaleString()}` });
            return;
        }
        tap(sign * n);
        setCustom('');
    };

    const setClosed = async (closed: boolean) => {
        try {
            show(await zikrApi.setClosed(id, closed));
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Could not update the session') });
        }
    };

    const remove = async () => {
        try {
            await zikrApi.remove(id);
            navigate('/zikr');
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Delete failed') });
            setConfirmDelete(false);
        }
    };

    if (missing) {
        return (
            <VStack p={10} spacing={4}>
                <Text>This zikr session doesn't exist or isn't open to you.</Text>
                <Button onClick={() => navigate('/zikr')}>Back to Zikr Sessions</Button>
            </VStack>
        );
    }
    if (!session) {
        return (
            <Flex align="center" justify="center" minH="100vh">
                <Spinner size="xl" />
            </Flex>
        );
    }

    const { target, total } = session;
    const reached = !!target && total >= target;

    return (
        <Box p={[4, 6]} maxW="760px" mx="auto">
            <Flex justify="space-between" align="center" mb={4} gap={2}>
                <Button leftIcon={<ArrowBackIcon />} colorScheme="blue" variant="outline" onClick={() => navigate('/zikr')}>
                    Sessions
                </Button>
                <HStack spacing={1} flexWrap="wrap" justify="end">
                    {session.organizations.map((o) => (
                        <Tag key={o} size="sm">
                            {o}
                        </Tag>
                    ))}
                    {session.canManage && (
                        <Menu>
                            <MenuButton as={IconButton} aria-label="Session options" icon={<HamburgerIcon />} variant="ghost" size="sm" />
                            <MenuList>
                                <MenuItem onClick={() => setClosed(!session.closed)}>
                                    {session.closed ? 'Reopen session' : 'Close session'}
                                </MenuItem>
                                <MenuItem color="red.500" onClick={() => setConfirmDelete(true)}>
                                    Delete session
                                </MenuItem>
                            </MenuList>
                        </Menu>
                    )}
                </HStack>
            </Flex>

            {session.closed && (
                <Alert status="info" borderRadius="md" mb={4}>
                    <AlertIcon />
                    This session is closed. Counts can't be changed.
                </Alert>
            )}

            <VStack spacing={1} mb={4}>
                <Heading size="md">{session.name}</Heading>
                <Box position="relative" display="inline-block" overflow="visible">
                    <Text fontSize={['5xl', '6xl']} fontWeight="extrabold" lineHeight="1.1" data-testid="zikr-total">
                        {total.toLocaleString()}
                    </Text>
                    {floats.map((f) => {
                        const label = f.amount > 0 ? `+${f.amount.toLocaleString()}` : f.amount.toLocaleString();
                        if (f.phase === 'pending') {
                            return (
                                <HStack
                                    key={f.id}
                                    position="absolute"
                                    left={`calc(100% + ${8 + f.drift}px)`}
                                    top="50%"
                                    transform="translateY(-50%)"
                                    spacing={2}
                                    pointerEvents="none"
                                    data-testid="zikr-float-pending"
                                    sx={{ animation: `${pendingPulse} 1s ease-in-out infinite` }}
                                >
                                    <Spinner size="sm" thickness="2px" speed="0.65s" color="gray.400" />
                                    <Text fontSize={['xl', '2xl']} fontWeight="extrabold" color="gray.400" whiteSpace="nowrap">
                                        {label}
                                    </Text>
                                </HStack>
                            );
                        }
                        return (
                            <Text
                                key={f.id}
                                position="absolute"
                                left={`calc(100% + ${8 + f.drift}px)`}
                                top="50%"
                                mt="-0.6em"
                                pointerEvents="none"
                                fontSize={['2xl', '3xl']}
                                fontWeight="extrabold"
                                color={f.amount > 0 ? 'green.500' : 'red.400'}
                                whiteSpace="nowrap"
                                data-testid="zikr-float"
                                sx={{ animation: `${arriveFromCloud} 0.9s ease-out forwards` }}
                            >
                                {label}
                            </Text>
                        );
                    })}
                </Box>
                <Text color="gray.500" fontSize="sm">
                    {target ? `of ${target.toLocaleString()} target · ` : ''}you've added {session.myCount.toLocaleString()}
                </Text>
                {reached && <Badge colorScheme="green">Target reached</Badge>}
            </VStack>
            {target ? (
                <Progress value={Math.min(100, (total / target) * 100)} colorScheme="green" borderRadius="full" mb={6} />
            ) : null}

            <SimpleGrid columns={5} spacing={2} mb={2}>
                {STEPS.map((n) => (
                    <Button key={n} colorScheme="accent" size="lg" px={0} onClick={() => tap(n)} isDisabled={session.closed}>
                        +{n}
                    </Button>
                ))}
            </SimpleGrid>
            <SimpleGrid columns={5} spacing={2} mb={4}>
                {STEPS.map((n) => (
                    <Button
                        key={n}
                        colorScheme="red"
                        variant="outline"
                        size="lg"
                        px={0}
                        onClick={() => tap(-n)}
                        isDisabled={session.closed}
                    >
                        −{n}
                    </Button>
                ))}
            </SimpleGrid>
            <HStack mb={8} justify="center">
                <Input
                    maxW="180px"
                    value={custom}
                    inputMode="numeric"
                    placeholder="Custom amount"
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && tapCustom(1)}
                    isDisabled={session.closed}
                />
                <Button colorScheme="accent" onClick={() => tapCustom(1)} isDisabled={session.closed}>
                    Add
                </Button>
                <Button colorScheme="red" variant="outline" onClick={() => tapCustom(-1)} isDisabled={session.closed}>
                    Subtract
                </Button>
            </HStack>

            <Heading size="sm" mb={2}>
                Contributions
            </Heading>
            {session.entries.length === 0 ? (
                <Text color="gray.500">No one has added anything yet.</Text>
            ) : (
                <Table size="sm">
                    <Tbody>
                        {session.entries.map((e, i) => (
                            <Tr key={`${e.name}-${i}`} bg={e.isMe ? 'green.50' : undefined} fontWeight={e.isMe ? 'semibold' : undefined}>
                                <Td w="40px" color="gray.500">
                                    {i + 1}
                                </Td>
                                <Td>{e.isMe ? `${e.name} (you)` : e.name}</Td>
                                <Td isNumeric>{e.count.toLocaleString()}</Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            )}
            <Text fontSize="xs" color="gray.400" mt={4}>
                Started by {session.isMine ? 'you' : session.createdBy}. Updates every few seconds.
            </Text>

            <AlertDialog isOpen={confirmDelete} leastDestructiveRef={cancelRef} onClose={() => setConfirmDelete(false)}>
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader>Delete "{session.name}"?</AlertDialogHeader>
                        <AlertDialogBody>Everyone's counts in this session will be removed. This can't be undone.</AlertDialogBody>
                        <AlertDialogFooter gap={3}>
                            <Button ref={cancelRef} onClick={() => setConfirmDelete(false)}>
                                Cancel
                            </Button>
                            <Button colorScheme="red" onClick={remove}>
                                Delete
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </Box>
    );
}

export default function ZikrSessionPage() {
    return (
        <AuthGuard>
            <ZikrSessionContent />
        </AuthGuard>
    );
}
