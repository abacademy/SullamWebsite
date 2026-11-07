// src/components/ZikrSessionModal.tsx
import React, { useEffect, useState } from 'react';
import {
    Button,
    Checkbox,
    FormControl,
    FormErrorMessage,
    FormHelperText,
    FormLabel,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    VStack,
    useToast,
} from '@chakra-ui/react';
import { ZikrDetail, errorMessage, zikrApi } from '../utils/zikr';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    orgs: string[];
    onCreated: (session: ZikrDetail) => void;
}

export default function ZikrSessionModal({ isOpen, onClose, orgs, onCreated }: Props) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const [target, setTarget] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setPicked(orgs.length === 1 ? orgs : []);
            setTarget('');
        }
    }, [isOpen, orgs]);

    const targetBad = target.trim() !== '' && !/^[1-9]\d{0,8}$/.test(target.trim());
    const canSave = name.trim() !== '' && picked.length > 0 && !targetBad && !saving;

    const toggle = (org: string) =>
        setPicked((p) => (p.includes(org) ? p.filter((o) => o !== org) : [...p, org]));

    const save = async () => {
        setSaving(true);
        try {
            const created = await zikrApi.create({
                name: name.trim(),
                organizations: picked,
                target: target.trim() ? parseInt(target.trim(), 10) : null,
            });
            onCreated(created);
        } catch (e) {
            toast({ status: 'error', title: errorMessage(e, 'Could not create the session') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>New Zikr Session</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={5} align="stretch">
                        <FormControl isRequired>
                            <FormLabel>Name</FormLabel>
                            <Input
                                value={name}
                                maxLength={120}
                                placeholder="Friday Salawat"
                                onChange={(e) => setName(e.target.value)}
                            />
                        </FormControl>

                        <FormControl isRequired>
                            <FormLabel>Orgs taking part</FormLabel>
                            <VStack align="start" spacing={1}>
                                {orgs.map((o) => (
                                    <Checkbox key={o} isChecked={picked.includes(o)} onChange={() => toggle(o)}>
                                        {o}
                                    </Checkbox>
                                ))}
                            </VStack>
                            <FormHelperText>
                                Every admin, teacher and helper in these orgs can join. Only orgs you're staff in are listed.
                            </FormHelperText>
                        </FormControl>

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
