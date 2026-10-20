// Kindergarten groups (JK, then SK) come before everything else.
const kindergartenRank = (name: string): number => {
    if (/^jk\b/i.test(name.trim())) return 0;
    if (/^sk\b/i.test(name.trim())) return 1;
    return 2;
};

// Sort group names: JK, SK, then Grade 1 before Grade 2 before Grade 10, fallback to alpha.
export const compareGroups = (a: string, b: string): number => {
    const rankA = kindergartenRank(a);
    const rankB = kindergartenRank(b);
    if (rankA !== rankB) return rankA - rankB;
    if (rankA < 2) return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const numA = a.match(/\d+/);
    const numB = b.match(/\d+/);
    if (numA && numB && numA[0] !== numB[0]) return parseInt(numA[0], 10) - parseInt(numB[0], 10);
    return a.localeCompare(b);
};
