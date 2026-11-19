// src/utils/taqm.ts
import axios, { AxiosError } from 'axios';
import { BASE_URL } from '../constants/ApiConfig';
import { errorMessage } from './zikr';

export { errorMessage };
export const POLL_MS = 4000;
export const GOAL_PRESETS = [41, 101] as const;
export const MAX_GOAL = 10000;

export const SURAH_KEYS = ['baqarah', 'anaam', 'yasin'] as const;
export type SurahKey = (typeof SURAH_KEYS)[number];

/** Yasin stays 5.5 in the math; progress totals are rounded at the end. */
export const SURAH_PAGES: Record<SurahKey, number> = {
    baqarah: 48,
    anaam: 23,
    yasin: 5.5,
};

export const SURAH_LABELS: Record<SurahKey, string> = {
    baqarah: 'بقرة',
    anaam: 'أنعام',
    yasin: 'يس',
};

export type CellStatus = 'empty' | 'in_progress' | 'done';
export type CellAction = 'claim' | 'done' | 'reset' | 'replace';

export interface TaqmCell {
    index: number;
    name: string;
    status: CellStatus;
    version: number;
    updatedBy: string | null;
    updatedAt: string | null;
}

export interface TaqmProgress {
    donePages: number;
    activePages: number;
    totalPages: number;
    claimedSlots: number;
    totalSlots: number;
}

export interface TaqmSummary {
    id: string;
    type: 'taqm';
    name: string;
    organizations: string[];
    goal: number;
    surahs: SurahKey[];
    progress: TaqmProgress;
    createdBy: string;
    isMine: boolean;
    canManage: boolean;
    closed: boolean;
    createdAt: string | null;
}

export interface TaqmTxn {
    id: string;
    surah: SurahKey;
    index: number;
    action: CellAction;
    name: string;
    prevStatus: CellStatus | null;
    prevName: string;
    actor: string;
    isMe: boolean;
    createdAt: string | null;
}

export interface TaqmDetail extends TaqmSummary {
    cells: Record<string, TaqmCell[]>;
    surahPages: Record<string, number>;
    transactions: TaqmTxn[];
}

export interface CellConflict {
    conflict: true;
    cell: TaqmCell;
    error: string;
}

const auth = () => ({ headers: { Authorization: localStorage.getItem('sulam_token') || '' } });

export function parseGoal(raw: string): number | null {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = parseInt(s, 10);
    return n >= 1 && n <= MAX_GOAL ? n : null;
}

export function isConflict(e: unknown): e is AxiosError<CellConflict> {
    const data = (e as AxiosError<CellConflict>)?.response?.data;
    return !!(data && data.conflict && data.cell);
}

export const taqmApi = {
    list: () => axios.get<TaqmSummary[]>(`${BASE_URL}/taqm/sessions`, auth()).then((r) => r.data),
    get: (id: string) => axios.get<TaqmDetail>(`${BASE_URL}/taqm/sessions/${id}`, auth()).then((r) => r.data),
    create: (body: { name: string; organizations: string[]; goal: number; surahs: SurahKey[] }) =>
        axios.post<TaqmDetail>(`${BASE_URL}/taqm/sessions`, body, auth()).then((r) => r.data),
    updateCell: (
        id: string,
        surah: SurahKey,
        index: number,
        body: { action: CellAction; name?: string; expectedVersion: number; force?: boolean }
    ) => axios.post<TaqmDetail>(`${BASE_URL}/taqm/sessions/${id}/cells/${surah}/${index}`, body, auth()).then((r) => r.data),
    setClosed: (id: string, closed: boolean) =>
        axios.patch<TaqmDetail>(`${BASE_URL}/taqm/sessions/${id}`, { closed }, auth()).then((r) => r.data),
    remove: (id: string) => axios.delete(`${BASE_URL}/taqm/sessions/${id}`, auth()),
};
