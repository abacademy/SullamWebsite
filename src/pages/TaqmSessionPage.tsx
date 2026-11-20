// src/pages/TaqmSessionPage.tsx
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    Alert,
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertIcon,
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    HStack,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    SimpleGrid,
    Spinner,
    Tag,
    Text,
    VStack,
    useDisclosure,
    useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon, ChevronDownIcon, ChevronRightIcon, HamburgerIcon } from '@chakra-ui/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { UserContext } from '../utils/UserContext';
import {
    POLL_MS,
    SURAH_LABELS,
    SurahKey,
    TaqmCell,
    TaqmDetail,
    TaqmTxn,
    errorMessage,
    isConflict,
    taqmApi,
} from '../utils/taqm';

const ACTION_LABEL: Record<TaqmTxn['action'], string> = {
    claim: 'claimed',
    done: 'marked done',
    reset: 'reset',
    replace: 'replaced',
};

function formatTxnTime(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function cellBg(status: TaqmCell['status']) {
    if (status === 'in_progress') return 'blue.500';
    if (status === 'done') return 'green.500';
    return 'gray.200';
}

function cellColor(status: TaqmCell['status']) {
    return status === 'empty' ? 'gray.700' : 'white';
}

function PageProgress({ session }: { session: TaqmDetail }) {
    const { donePages, activePages, totalPages } = session.progress;
    const donePct = totalPages ? (donePages / totalPages) * 100 : 0;
    const activePct = totalPages ? (activePages / totalPages) * 100 : 0;
    const filled = donePages + activePages;
    return (
        <Box mb={6}>
            <Flex justify="space-between" mb={2} gap={2} flexWrap="wrap">
                <Text fontWeight="semibold">
                    {filled.toLocaleString()} / {totalPages.toLocaleString()} pages
                </Text>
                <Text fontSize="sm" color="gray.500">
                    {donePages.toLocaleString()} done · {activePages.toLocaleString()} in progress
                </Text>
            </Flex>
            <Box position="relative" h="12px" borderRadius="full" bg="gray.100" overflow="hidden">
                <Box
                    position="absolute"
                    left={0}
                    top={0}
                    h="100%"
                    w={`${Math.min(100, donePct + activePct)}%`}
                    bg="blue.300"
                    transition="width 0.2s"
                />
                <Box
                    position="absolute"
                    left={0}
                    top={0}
                    h="100%"
                    w={`${Math.min(100, donePct)}%`}
                    bg="green.400"
                    transition="width 0.2s"
                />
            </Box>
        </Box>
    );
}

function CellButton({
    cell,
    disabled,
    onClick,
}: {
    cell: TaqmCell;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            h="auto"
            minH="52px"
            py={2}
            px={1}
            fontSize="xs"
            whiteSpace="normal"
            lineHeight="1.2"
            bg={cellBg(cell.status)}
            color={cellColor(cell.status)}
            _hover={{ opacity: disabled ? 1 : 0.9, bg: cellBg(cell.status) }}
            _active={{ bg: cellBg(cell.status) }}
            isDisabled={disabled}
            onClick={onClick}
            title={cell.name || `#${cell.index + 1}`}
        >
            <VStack spacing={0}>
                <Text fontWeight="bold">{cell.index + 1}</Text>
                {cell.name ? (
                    <Text noOfLines={1} maxW="100%">
                        {cell.name}
                    </Text>
                ) : null}
            </VStack>
        </Button>
    );
}

export function TaqmSessionContent() {
    const { id = '' } = useParams();
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen: showTxns, onToggle: toggleTxns } = useDisclosure();

    const [session, setSession] = useState<TaqmDetail | null>(null);
    const [missing, setMissing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [claimOpen, setClaimOpen] = useState(false);
    const [claimName, setClaimName] = useState('');
    const [claimTarget, setClaimTarget] = useState<{ surah: SurahKey; cell: TaqmCell } | null>(null);
    const [conflict, setConflict] = useState<{
        surah: SurahKey;
        index: number;
        name: string;
        cell: TaqmCell;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const myName = (user?.full_name || '').trim();

    const cancelRef = useRef<HTMLButtonElement>(null);
    const conflictCancelRef = useRef<HTMLButtonElement>(null);
    const current = useRef<TaqmDetail | null>(null);
    const dialogOpen = useRef(false);
    const inFlight = useRef(0);

    useEffect(() => {
        dialogOpen.current = claimOpen || !!conflict;
    }, [claimOpen, conflict]);

    const show = (s: TaqmDetail) => {
        current.current = s;
        setSession(s);
    };

    const refresh = useCallback(async () => {
        try {
            const data = await taqmApi.get(id);
            if (inFlight.current === 0 && !dialogOpen.current) show(data);
            else if (inFlight.current === 0) {
                // Keep dialogs; still refresh underlying ref for later.
                current.current = data;
            }
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

    const setClosed = async (closed: boolean) => {
        try {
            show(await taqmApi.setClosed(id, closed));
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Could not update the session') });
        }
    };

    const remove = async () => {
        try {
            await taqmApi.remove(id);
            navigate('/sessions');
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Delete failed') });
            setConfirmDelete(false);
        }
    };

    const openClaim = (surah: SurahKey, cell: TaqmCell) => {
        setClaimTarget({ surah, cell });
        setClaimName('');
        setClaimOpen(true);
    };

    const submitClaim = async (force = false, override?: { surah: SurahKey; index: number; name: string; version: number }) => {
        const target = override
            ? { surah: override.surah, index: override.index, name: override.name, version: override.version }
            : claimTarget
              ? {
                    surah: claimTarget.surah,
                    index: claimTarget.cell.index,
                    name: claimName.trim(),
                    version: claimTarget.cell.version,
                }
              : null;
        if (!target || !target.name) {
            toast({ status: 'warning', title: 'Enter a name' });
            return;
        }

        setBusy(true);
        inFlight.current += 1;
        try {
            const data = await taqmApi.updateCell(id, target.surah, target.index, {
                action: force ? 'replace' : 'claim',
                name: target.name,
                expectedVersion: target.version,
                force,
            });
            show(data);
            setClaimOpen(false);
            setClaimTarget(null);
            setConflict(null);
        } catch (e) {
            if (isConflict(e) && e.response?.data?.cell) {
                setClaimOpen(false);
                setConflict({
                    surah: target.surah,
                    index: target.index,
                    name: target.name,
                    cell: e.response.data.cell,
                });
            } else {
                toast({ status: 'error', title: errorMessage(e, 'Could not update that slot') });
            }
        } finally {
            inFlight.current -= 1;
            setBusy(false);
            if (inFlight.current === 0) refresh();
        }
    };

    const advanceCell = async (surah: SurahKey, cell: TaqmCell) => {
        if (!session || session.closed) return;
        if (cell.status === 'empty') {
            openClaim(surah, cell);
            return;
        }

        const action = cell.status === 'in_progress' ? 'done' : 'reset';
        setBusy(true);
        inFlight.current += 1;
        try {
            show(
                await taqmApi.updateCell(id, surah, cell.index, {
                    action,
                    expectedVersion: cell.version,
                })
            );
        } catch (e) {
            if (isConflict(e)) {
                toast({
                    status: 'info',
                    title: 'That slot just changed',
                    description: 'The board refreshed — try again.',
                });
                await refresh();
            } else {
                toast({ status: 'error', title: errorMessage(e, 'Could not update that slot') });
            }
        } finally {
            inFlight.current -= 1;
            setBusy(false);
        }
    };

    if (missing) {
        return (
            <VStack p={10} spacing={4}>
                <Text>This taqm session doesn't exist or isn't open to you.</Text>
                <Button onClick={() => navigate('/sessions')}>Back to Sessions</Button>
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

    return (
        <Box p={[4, 6]} maxW="1100px" mx="auto">
            <Flex justify="space-between" align="center" mb={4} gap={2}>
                <Button leftIcon={<ArrowBackIcon />} colorScheme="blue" variant="outline" onClick={() => navigate('/sessions')}>
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
                    This session is closed. Slots can't be changed.
                </Alert>
            )}

            <Heading size="md" mb={1}>
                {session.name}
            </Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>
                Goal {session.goal} per surah · tap empty to claim, in-progress to finish, done to reset
            </Text>

            <PageProgress session={session} />

            <VStack align="stretch" spacing={8}>
                {session.surahs.map((surah) => {
                    const cells = session.cells[surah] || [];
                    const pages = session.surahPages[surah] ?? 0;
                    const done = cells.filter((c) => c.status === 'done').length;
                    return (
                        <Box key={surah}>
                            <Flex justify="space-between" align="baseline" mb={3} gap={2}>
                                <HStack spacing={2} align="baseline">
                                    <Heading size="sm">
                                        {SURAH_LABELS[surah as SurahKey] || surah}
                                    </Heading>
                                    <Text fontSize="sm" fontWeight="semibold" color="gray.600">
                                        {done}/{session.goal}
                                    </Text>
                                </HStack>
                                <Text fontSize="sm" color="gray.500">
                                    {pages} pages each
                                </Text>
                            </Flex>
                            <SimpleGrid columns={[4, 6, 8, 10]} spacing={2}>
                                {cells.map((cell) => (
                                    <CellButton
                                        key={`${surah}-${cell.index}`}
                                        cell={cell}
                                        disabled={session.closed || busy}
                                        onClick={() => advanceCell(surah as SurahKey, cell)}
                                    />
                                ))}
                            </SimpleGrid>
                        </Box>
                    );
                })}
            </VStack>

            <Text fontSize="xs" color="gray.400" mt={6} mb={4}>
                Started by {session.isMine ? 'you' : session.createdBy}. Updates every few seconds.
            </Text>

            <Box borderTopWidth="1px" pt={4}>
                <HStack mb={2} cursor="pointer" onClick={toggleTxns} spacing={1}>
                    {showTxns ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    <Heading size="sm">Activity ({(session.transactions || []).length})</Heading>
                </HStack>
                {showTxns &&
                    ((session.transactions || []).length === 0 ? (
                        <Text color="gray.500" fontSize="sm">
                            No changes yet.
                        </Text>
                    ) : (
                        <VStack align="stretch" spacing={2} maxH="320px" overflowY="auto" pr={1}>
                            {(session.transactions || []).map((t) => (
                                <Box key={t.id} fontSize="sm" py={1} borderBottomWidth="1px" borderColor="gray.100">
                                    <Text>
                                        <Text as="span" fontWeight="semibold">
                                            {t.isMe ? `${t.actor} (you)` : t.actor}
                                        </Text>{' '}
                                        {ACTION_LABEL[t.action] || t.action}{' '}
                                        <Text as="span" fontWeight="medium">
                                            {SURAH_LABELS[t.surah] || t.surah} #{t.index + 1}
                                        </Text>
                                        {t.name ? (
                                            <Text as="span" color="gray.600">
                                                {' '}
                                                as “{t.name}”
                                            </Text>
                                        ) : null}
                                        {t.action === 'replace' && t.prevName ? (
                                            <Text as="span" color="gray.500">
                                                {' '}
                                                (was “{t.prevName}”)
                                            </Text>
                                        ) : null}
                                    </Text>
                                    <Text fontSize="xs" color="gray.400">
                                        {formatTxnTime(t.createdAt)}
                                    </Text>
                                </Box>
                            ))}
                        </VStack>
                    ))}
            </Box>

            <Modal
                isOpen={claimOpen}
                onClose={() => {
                    setClaimOpen(false);
                    setClaimTarget(null);
                    if (current.current) show(current.current);
                    else refresh();
                }}
                isCentered
            >
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>
                        Claim slot #{(claimTarget?.cell.index ?? 0) + 1}
                        {claimTarget ? ` · ${SURAH_LABELS[claimTarget.surah]}` : ''}
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <FormControl>
                            <FormLabel>Name</FormLabel>
                            <Input
                                autoFocus
                                value={claimName}
                                maxLength={120}
                                placeholder="Your name or someone else's"
                                onChange={(e) => setClaimName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitClaim(false)}
                            />
                            {myName ? (
                                <Button
                                    mt={2}
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setClaimName(myName)}
                                >
                                    Put My name
                                </Button>
                            ) : null}
                        </FormControl>
                    </ModalBody>
                    <ModalFooter gap={3}>
                        <Button variant="ghost" onClick={() => setClaimOpen(false)}>
                            Cancel
                        </Button>
                        <Button colorScheme="blue" onClick={() => submitClaim(false)} isLoading={busy} isDisabled={!claimName.trim()}>
                            Claim
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <AlertDialog
                isOpen={!!conflict}
                leastDestructiveRef={conflictCancelRef}
                onClose={() => {
                    setConflict(null);
                    refresh();
                }}
            >
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader>Slot already claimed</AlertDialogHeader>
                        <AlertDialogBody>
                            {conflict
                                ? `This slot was just claimed by "${conflict.cell.name || 'someone else'}". Keep theirs, or replace with "${conflict.name}"?`
                                : null}
                        </AlertDialogBody>
                        <AlertDialogFooter gap={3}>
                            <Button
                                ref={conflictCancelRef}
                                onClick={() => {
                                    setConflict(null);
                                    refresh();
                                }}
                            >
                                Keep theirs
                            </Button>
                            <Button
                                colorScheme="orange"
                                isLoading={busy}
                                onClick={() =>
                                    conflict &&
                                    submitClaim(true, {
                                        surah: conflict.surah,
                                        index: conflict.index,
                                        name: conflict.name,
                                        version: conflict.cell.version,
                                    })
                                }
                            >
                                Replace with mine
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>

            <AlertDialog isOpen={confirmDelete} leastDestructiveRef={cancelRef} onClose={() => setConfirmDelete(false)}>
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader>Delete "{session.name}"?</AlertDialogHeader>
                        <AlertDialogBody>All slots and history for this session will be removed. This can't be undone.</AlertDialogBody>
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

export default function TaqmSessionPage() {
    return (
        <AuthGuard>
            <TaqmSessionContent />
        </AuthGuard>
    );
}
