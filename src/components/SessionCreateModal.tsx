// src/components/SessionCreateModal.tsx
import React, { useEffect, useState } from 'react';
import {
    Button,
    Checkbox,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    HStack,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Radio,
    RadioGroup,
    Stack,
    Text,
    VStack,
    useToast,
} from '@chakra-ui/react';
import { ZikrDetail, errorMessage, zikrApi } from '../utils/zikr';
import {
    GOAL_PRESETS,
    SURAH_KEYS,
    SURAH_LABELS,
    SurahKey,
    TaqmDetail,
    parseGoal,
    taqmApi,
} from '../utils/taqm';

export type CreatedSession =
    | { kind: 'zikr'; session: ZikrDetail }
    | { kind: 'taqm'; session: TaqmDetail };

interface Props {
    isOpen: boolean;
    onClose: () => void;
    orgs: string[];
    onCreated: (created: CreatedSession) => void;
}

export default function SessionCreateModal({ isOpen, onClose, orgs, onCreated }: Props) {
    const toast = useToast();
    const [kind, setKind] = useState<'zikr' | 'taqm'>('zikr');
    const [name, setName] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const [target, setTarget] = useState('');
    const [goalMode, setGoalMode] = useState<'41' | '101' | 'custom'>('101');
    const [customGoal, setCustomGoal] = useState('');
    const [surahs, setSurahs] = useState<SurahKey[]>([...SURAH_KEYS]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setKind('zikr');
            setName('');
            setPicked(orgs.length === 1 ? orgs : []);
            setTarget('');
            setGoalMode('101');
            setCustomGoal('');
            setSurahs([...SURAH_KEYS]);
        }
    }, [isOpen, orgs]);

    const targetBad = target.trim() !== '' && !/^[1-9]\d{0,8}$/.test(target.trim());
    const customGoalNum = parseGoal(customGoal);
    const customGoalBad = goalMode === 'custom' && customGoal.trim() !== '' && customGoalNum === null;
    const goalValue =
        goalMode === 'custom' ? customGoalNum : goalMode === '41' ? 41 : 101;

    const canSave =
        name.trim() !== '' &&
        picked.length > 0 &&
        !saving &&
        (kind === 'zikr'
            ? !targetBad
            : surahs.length > 0 && goalValue !== null && !customGoalBad);

    const toggleOrg = (org: string) =>
        setPicked((p) => (p.includes(org) ? p.filter((o) => o !== org) : [...p, org]));

    const toggleSurah = (s: SurahKey) =>
        setSurahs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

    const save = async () => {
        setSaving(true);
        try {
            if (kind === 'zikr') {
                const session = await zikrApi.create({
                    name: name.trim(),
                    organizations: picked,
                    target: target.trim() ? parseInt(target.trim(), 10) : null,
                });
                onCreated({ kind: 'zikr', session });
            } else {
                if (goalValue === null || surahs.length === 0) return;
                const session = await taqmApi.create({
                    name: name.trim(),
                    organizations: picked,
                    goal: goalValue,
                    surahs,
                });
                onCreated({ kind: 'taqm', session });
            }
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Could not create the session') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>New Session</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={5} align="stretch">
                        <FormControl isRequired>
                            <FormLabel>Type</FormLabel>
                            <RadioGroup value={kind} onChange={(v) => setKind(v as 'zikr' | 'taqm')}>
                                <HStack spacing={6}>
                                    <Radio value="zikr">Zikr</Radio>
                                    <Radio value="taqm">Taqm</Radio>
                                </HStack>
                            </RadioGroup>
                        </FormControl>

                        <FormControl isRequired>
                            <FormLabel>Name</FormLabel>
                            <Input
                                value={name}
                                maxLength={120}
                                placeholder={kind === 'zikr' ? 'Friday Salawat' : 'Friday Taqm'}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </FormControl>

                        <FormControl isRequired>
                            <FormLabel>Orgs taking part</FormLabel>
                            <VStack align="start" spacing={1}>
                                {orgs.map((o) => (
                                    <Checkbox key={o} isChecked={picked.includes(o)} onChange={() => toggleOrg(o)}>
                                        {o}
                                    </Checkbox>
                                ))}
                            </VStack>
                            <FormHelperText>
                                Every admin, teacher and helper in these orgs can join. Only orgs you're staff in are
                                listed.
                            </FormHelperText>
                        </FormControl>

                        {kind === 'zikr' ? (
                            <FormControl isInvalid={targetBad}>
                                <FormLabel>
                                    Target{' '}
                                    <Text as="span" color="gray.500" fontWeight="normal">
                                        (optional)
                                    </Text>
                                </FormLabel>
                                <Input
                                    value={target}
                                    inputMode="numeric"
                                    placeholder="100000"
                                    onChange={(e) => setTarget(e.target.value)}
                                />
                                <FormErrorMessage>Enter a whole number above zero.</FormErrorMessage>
                            </FormControl>
                        ) : (
                            <>
                                <FormControl isRequired isInvalid={customGoalBad}>
                                    <FormLabel>Goal (slots per surah)</FormLabel>
                                    <RadioGroup
                                        value={goalMode}
                                        onChange={(v) => setGoalMode(v as '41' | '101' | 'custom')}
                                    >
                                        <Stack direction={['column', 'row']} spacing={4}>
                                            {GOAL_PRESETS.map((n) => (
                                                <Radio key={n} value={String(n)}>
                                                    {n}
                                                </Radio>
                                            ))}
                                            <Radio value="custom">Custom</Radio>
                                        </Stack>
                                    </RadioGroup>
                                    {goalMode === 'custom' && (
                                        <Input
                                            mt={3}
                                            value={customGoal}
                                            inputMode="numeric"
                                            placeholder="e.g. 50"
                                            onChange={(e) => setCustomGoal(e.target.value)}
                                        />
                                    )}
                                    <FormErrorMessage>Enter a whole number from 1 to 10,000.</FormErrorMessage>
                                </FormControl>

                                <FormControl isRequired>
                                    <FormLabel>Surahs</FormLabel>
                                    <VStack align="start" spacing={1}>
                                        {SURAH_KEYS.map((s) => (
                                            <Checkbox
                                                key={s}
                                                isChecked={surahs.includes(s)}
                                                onChange={() => toggleSurah(s)}
                                            >
                                                {SURAH_LABELS[s]}
                                            </Checkbox>
                                        ))}
                                    </VStack>
                                    <FormHelperText>Pick at least one surah to include.</FormHelperText>
                                </FormControl>
                            </>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter gap={3}>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="accent" onClick={save} isDisabled={!canSave} isLoading={saving}>
                        Create
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
