import { compareGroups } from './sortGroups';

it('puts JK, then SK, before grades', () => {
    expect(['Grade 10', 'SK', 'Grade 2', 'jk', 'Grade 1', 'SK 2', 'JK B'].sort(compareGroups)).toEqual([
        'jk',
        'JK B',
        'SK',
        'SK 2',
        'Grade 1',
        'Grade 2',
        'Grade 10',
    ]);
});

it('only matches JK/SK as a whole word', () => {
    expect(['Skills', 'SK', 'Jkids'].sort(compareGroups)).toEqual(['SK', 'Jkids', 'Skills']);
});
