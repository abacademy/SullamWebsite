// src/utils/zikr.ts
import axios from 'axios';
import { BASE_URL } from '../constants/ApiConfig';

export const STAFF_ROLES = ['admin', 'teacher', 'rabtteacher', 'helper'];
export const STEPS = [50, 100, 250, 500, 1000];
export const MAX_STEP = 100000;
export const POLL_MS = 4000;

export interface ZikrEntry {
    name: string;
    count: number;
    isMe: boolean;
}

export interface ZikrSummary {
    id: string;
    name: string;
    organizations: string[];
    target: number | null;
    total: number;
    contributors: number;
    createdBy: string;
    isMine: boolean;
    canManage: boolean;
    closed: boolean;
    createdAt: string | null;
}

export interface ZikrDetail extends ZikrSummary {
    myCount: number;
    entries: ZikrEntry[];
}

/** Orgs where the user is an admin, teacher or helper. */
export function staffOrgs(user: any): string[] {
    const orgs = user?.organizations || {};
    return Object.keys(orgs)
        .filter((o) => STAFF_ROLES.includes(orgs[o]?.role))
        .sort();
}

/** Whole number 1..MAX_STEP from the custom box, or null. */
export function parseAmount(raw: string): number | null {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = parseInt(s, 10);
    return n >= 1 && n <= MAX_STEP ? n : null;
}

const byCount = (a: ZikrEntry, b: ZikrEntry) =>
    b.count - a.count || a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/**
 * Apply a tap locally before the server answers. Subtracting never takes the
 * user's own count below zero. Returns the new session and the amount actually
 * applied (0 means nothing to send).
 */
export function applyTap(s: ZikrDetail, amount: number, myName: string): [ZikrDetail, number] {
    const applied = amount < 0 ? -Math.min(-amount, s.myCount) : amount;
    if (applied === 0) return [s, 0];
    const myCount = s.myCount + applied;
    const others = s.entries.filter((e) => !e.isMe);
    const mine = s.entries.find((e) => e.isMe);
    const entries = myCount > 0 ? [...others, { name: mine?.name || myName, count: myCount, isMe: true }] : others;
    entries.sort(byCount);
    return [
        { ...s, myCount, total: s.total + applied, entries, contributors: entries.length },
        applied,
    ];
}

const auth = () => ({ headers: { Authorization: localStorage.getItem('sulam_token') || '' } });

export const zikrApi = {
    list: () => axios.get<ZikrSummary[]>(`${BASE_URL}/zikr/sessions`, auth()).then((r) => r.data),
    get: (id: string) => axios.get<ZikrDetail>(`${BASE_URL}/zikr/sessions/${id}`, auth()).then((r) => r.data),
    create: (body: { name: string; organizations: string[]; target: number | null }) =>
        axios.post<ZikrDetail>(`${BASE_URL}/zikr/sessions`, body, auth()).then((r) => r.data),
    count: (id: string, amount: number) =>
        axios.post<ZikrDetail>(`${BASE_URL}/zikr/sessions/${id}/count`, { amount }, auth()).then((r) => r.data),
    setClosed: (id: string, closed: boolean) =>
        axios.patch<ZikrDetail>(`${BASE_URL}/zikr/sessions/${id}`, { closed }, auth()).then((r) => r.data),
    remove: (id: string) => axios.delete(`${BASE_URL}/zikr/sessions/${id}`, auth()),
};

export const errorMessage = (e: any, fallback: string) => e?.response?.data?.error || fallback;
