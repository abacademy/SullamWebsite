import { ZikrDetail, applyTap, parseAmount, staffOrgs } from './zikr';

jest.mock('axios', () => ({ __esModule: true, default: {} }));

const base: ZikrDetail = {
    id: 's1',
    name: 'Friday',
    organizations: ['a'],
    target: null,
    total: 400,
    contributors: 2,
    createdBy: 'T',
    isMine: false,
    canManage: false,
    closed: false,
    createdAt: null,
    myCount: 100,
    entries: [
        { name: 'Other', count: 300, isMe: false },
        { name: 'Me', count: 100, isMe: true },
    ],
};

test('staffOrgs keeps admin/teacher/helper orgs only', () => {
    const user = { organizations: { b: { role: 'helper' }, a: { role: 'admin' }, c: { role: 'member' }, d: { role: 'rabtteacher' } } };
    expect(staffOrgs(user)).toEqual(['a', 'b', 'd']);
    expect(staffOrgs(null)).toEqual([]);
});

test('parseAmount accepts whole numbers 1..100000 only', () => {
    expect(parseAmount(' 75 ')).toBe(75);
    expect(parseAmount('100000')).toBe(100000);
    for (const bad of ['', '0', '-5', '1.5', 'abc', '100001', '1e3']) expect(parseAmount(bad)).toBeNull();
});

test('adding moves me up the list', () => {
    const [next, applied] = applyTap(base, 250, 'Me');
    expect(applied).toBe(250);
    expect(next.total).toBe(650);
    expect(next.myCount).toBe(350);
    expect(next.entries.map((e) => e.name)).toEqual(['Me', 'Other']);
});

test('first tap adds me to the list', () => {
    const s = { ...base, myCount: 0, total: 300, entries: [base.entries[0]] };
    const [next] = applyTap(s, 50, 'New Me');
    expect(next.entries).toContainEqual({ name: 'New Me', count: 50, isMe: true });
    expect(next.contributors).toBe(2);
});

test('subtracting stops at zero and drops me from the list', () => {
    const [next, applied] = applyTap(base, -1000, 'Me');
    expect(applied).toBe(-100);
    expect(next.total).toBe(300);
    expect(next.myCount).toBe(0);
    expect(next.entries.map((e) => e.name)).toEqual(['Other']);
});

test('subtracting with nothing left is a no-op', () => {
    const s = { ...base, myCount: 0 };
    const [next, applied] = applyTap(s, -50, 'Me');
    expect(applied).toBe(0);
    expect(next).toBe(s);
});
