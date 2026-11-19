// src/pages/ZikrSessionList.tsx — unified Sessions list (zikr + taqm)
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Progress,
    SimpleGrid,
    Spinner,
    Stack,
    Tag,
    Text,
    useDisclosure,
    useToast,
} from '@chakra-ui/react';
import { AddIcon, ArrowBackIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import SessionCreateModal from '../components/SessionCreateModal';
import { UserContext } from '../utils/UserContext';
import { ZikrSummary, errorMessage, staffOrgs, zikrApi } from '../utils/zikr';
import { TaqmSummary, taqmApi } from '../utils/taqm';

type ListItem =
    | { kind: 'zikr'; session: ZikrSummary; createdAt: string | null }
    | { kind: 'taqm'; session: TaqmSummary; createdAt: string | null };

function ZikrCard({ s, onOpen }: { s: ZikrSummary; onOpen: () => void }) {
    const people = `${s.contributors} ${s.contributors === 1 ? 'person' : 'people'} contributed`;
    return (
        <Box
            p={5}
            borderWidth="1px"
            borderRadius="lg"
            bg="white"
            shadow="sm"
            cursor="pointer"
            _hover={{ shadow: 'md' }}
            onClick={onOpen}
        >
            <Flex justify="space-between" align="start" gap={2} mb={1}>
                <HStack align="start" spacing={2}>
                    <Heading size="sm">{s.name}</Heading>
                    <Badge colorScheme="purple">Zikr</Badge>
                </HStack>
                <HStack spacing={1} flexWrap="wrap" justify="end">
                    {s.organizations.map((o) => (
                        <Tag key={o} size="sm">
                            {o}
                        </Tag>
                    ))}
                </HStack>
            </Flex>
            <Text fontSize="2xl" fontWeight="bold">
                {s.total.toLocaleString()}
                {s.target ? (
                    <Text as="span" fontSize="md" color="gray.500" fontWeight="normal">
                        {' '}
                        / {s.target.toLocaleString()}
                    </Text>
                ) : null}
            </Text>
            {s.target ? (
                <Progress value={Math.min(100, (s.total / s.target) * 100)} colorScheme="green" borderRadius="full" size="sm" my={2} />
            ) : null}
            <Text fontSize="sm" color="gray.500">
                {s.target ? '' : 'No target · '}
                {people} · started by {s.isMine ? 'you' : s.createdBy}
            </Text>
        </Box>
    );
}

function TaqmCard({ s, onOpen }: { s: TaqmSummary; onOpen: () => void }) {
    const { donePages, activePages, totalPages } = s.progress;
    const filled = totalPages ? Math.min(100, ((donePages + activePages) / totalPages) * 100) : 0;
    const donePct = totalPages ? Math.min(100, (donePages / totalPages) * 100) : 0;
    return (
        <Box
            p={5}
            borderWidth="1px"
            borderRadius="lg"
            bg="white"
            shadow="sm"
            cursor="pointer"
            _hover={{ shadow: 'md' }}
            onClick={onOpen}
        >
            <Flex justify="space-between" align="start" gap={2} mb={1}>
                <HStack align="start" spacing={2}>
                    <Heading size="sm">{s.name}</Heading>
                    <Badge colorScheme="teal">Taqm</Badge>
                </HStack>
                <HStack spacing={1} flexWrap="wrap" justify="end">
                    {s.organizations.map((o) => (
                        <Tag key={o} size="sm">
                            {o}
                        </Tag>
                    ))}
                </HStack>
            </Flex>
            <Text fontSize="2xl" fontWeight="bold">
                {(donePages + activePages).toLocaleString()}
                <Text as="span" fontSize="md" color="gray.500" fontWeight="normal">
                    {' '}
                    / {totalPages.toLocaleString()} pages
                </Text>
            </Text>
            <Box position="relative" my={2} h="8px" borderRadius="full" bg="gray.100" overflow="hidden">
                <Box position="absolute" left={0} top={0} h="100%" w={`${filled}%`} bg="blue.200" />
                <Box position="absolute" left={0} top={0} h="100%" w={`${donePct}%`} bg="green.400" />
            </Box>
            <Text fontSize="sm" color="gray.500">
                Goal {s.goal} · {s.surahs.length} surah{s.surahs.length === 1 ? '' : 's'} · started by{' '}
                {s.isMine ? 'you' : s.createdBy}
            </Text>
        </Box>
    );
}

function SessionListContent() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const toast = useToast();
    const [items, setItems] = useState<ListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const { isOpen: showClosed, onToggle: toggleClosed } = useDisclosure();
    const myOrgs = useMemo(() => staffOrgs(user), [user]);

    const load = useCallback(async () => {
        try {
            const [zikr, taqm] = await Promise.all([zikrApi.list(), taqmApi.list()]);
            const merged: ListItem[] = [
                ...zikr.map((session) => ({ kind: 'zikr' as const, session, createdAt: session.createdAt })),
                ...taqm.map((session) => ({ kind: 'taqm' as const, session, createdAt: session.createdAt })),
            ];
            merged.sort((a, b) => {
                const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                return tb - ta;
            });
            setItems(merged);
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Failed to load sessions') });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <Flex align="center" justify="center" minH="100vh">
                <Spinner size="xl" />
            </Flex>
        );
    }

    const open = items.filter((i) => !i.session.closed);
    const closed = items.filter((i) => i.session.closed);

    const card = (item: ListItem) =>
        item.kind === 'zikr' ? (
            <ZikrCard key={`zikr-${item.session.id}`} s={item.session} onOpen={() => navigate(`/zikr/${item.session.id}`)} />
        ) : (
            <TaqmCard key={`taqm-${item.session.id}`} s={item.session} onOpen={() => navigate(`/taqm/${item.session.id}`)} />
        );

    return (
        <Box p={6}>
            <Stack direction={['column', 'row']} justify="space-between" align={['start', 'center']} mb={6} spacing={3}>
                <Heading size="lg">Sessions</Heading>
                <Stack direction="row" spacing={3}>
                    <Button leftIcon={<ArrowBackIcon />} colorScheme="blue" variant="outline" onClick={() => navigate('/leaderboards')}>
                        Leaderboards
                    </Button>
                    {myOrgs.length > 0 && (
                        <Button leftIcon={<AddIcon />} colorScheme="accent" onClick={() => setShowCreate(true)}>
                            New Session
                        </Button>
                    )}
                </Stack>
            </Stack>

            {open.length === 0 ? (
                <Text color="gray.500" mb={8}>
                    {myOrgs.length > 0
                        ? 'No open sessions yet. Start one with "New Session".'
                        : 'Sessions are for admins, teachers and helpers.'}
                </Text>
            ) : (
                <SimpleGrid columns={[1, 2]} spacing={6} mb={8}>
                    {open.map(card)}
                </SimpleGrid>
            )}

            {closed.length > 0 && (
                <>
                    <HStack mb={2} cursor="pointer" onClick={toggleClosed}>
                        {showClosed ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        <Heading size="md">Closed ({closed.length})</Heading>
                    </HStack>
                    {showClosed && (
                        <SimpleGrid columns={[1, 2]} spacing={6}>
                            {closed.map(card)}
                        </SimpleGrid>
                    )}
                </>
            )}

            <SessionCreateModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                orgs={myOrgs}
                onCreated={(created) => {
                    setShowCreate(false);
                    if (created.kind === 'zikr') navigate(`/zikr/${created.session.id}`);
                    else navigate(`/taqm/${created.session.id}`);
                }}
            />
        </Box>
    );
}

export default function ZikrSessionList() {
    return (
        <AuthGuard>
            <SessionListContent />
        </AuthGuard>
    );
}
