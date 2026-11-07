// src/pages/ZikrSessionList.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
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
import ZikrSessionModal from '../components/ZikrSessionModal';
import { UserContext } from '../utils/UserContext';
import { ZikrSummary, errorMessage, staffOrgs, zikrApi } from '../utils/zikr';

function SessionCard({ s, onOpen }: { s: ZikrSummary; onOpen: () => void }) {
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
                <Heading size="sm">{s.name}</Heading>
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

function ZikrSessionListContent() {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();
    const toast = useToast();
    const [sessions, setSessions] = useState<ZikrSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const { isOpen: showClosed, onToggle: toggleClosed } = useDisclosure();
    const myOrgs = useMemo(() => staffOrgs(user), [user]);

    const load = useCallback(async () => {
        try {
            setSessions(await zikrApi.list());
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Failed to load zikr sessions') });
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

    const open = sessions.filter((s) => !s.closed);
    const closed = sessions.filter((s) => s.closed);
    const card = (s: ZikrSummary) => <SessionCard key={s.id} s={s} onOpen={() => navigate(`/zikr/${s.id}`)} />;

    return (
        <Box p={6}>
            <Stack direction={['column', 'row']} justify="space-between" align={['start', 'center']} mb={6} spacing={3}>
                <Heading size="lg">Zikr Sessions</Heading>
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
                        : 'Zikr sessions are for admins, teachers and helpers.'}
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

            <ZikrSessionModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                orgs={myOrgs}
                onCreated={(s) => {
                    setShowCreate(false);
                    navigate(`/zikr/${s.id}`);
                }}
            />
        </Box>
    );
}

export default function ZikrSessionList() {
    return (
        <AuthGuard>
            <ZikrSessionListContent />
        </AuthGuard>
    );
}
