import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { ChakraProvider } from '@chakra-ui/react';
import LeaderboardModal from './LeaderboardModal';

jest.mock('axios', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

function orgUser(id: string, full_name: string, org: string, groups: string[]) {
    return { _id: { $oid: id }, full_name, organizations: { [org]: { groups, role: 'member' } } };
}

const ORG_USERS = {
    'Org A': [
        orgUser('a1', 'Aisha One', 'Org A', ['Grade 1']),
        orgUser('a2', 'Bilal Two', 'Org A', ['Grade 1']),
        orgUser('a3', 'Careem Three', 'Org A', ['Grade 2']),
        orgUser('a4', 'Dawud Four', 'Org A', []),
    ],
    'Org B': [orgUser('b1', 'Eesa Five', 'Org B', ['Grade 1'])],
};

function renderModal() {
    return render(
        <ChakraProvider>
            <LeaderboardModal isOpen mode="create" onClose={() => {}} onSuccess={() => {}} />
        </ChakraProvider>
    );
}

const groupCheckbox = (name: string) =>
    within(screen.getAllByText(name)[0].closest('button') as HTMLElement).getByRole('checkbox', { hidden: true });

beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockResolvedValue({ data: ORG_USERS });
    mockedAxios.post.mockResolvedValue({ data: {} });
});

it('does not mount student rows while their group is collapsed', async () => {
    renderModal();
    await waitFor(() => expect(screen.getAllByText('Org A').length).toBeGreaterThan(0));

    expect(screen.queryByText('Aisha One')).not.toBeInTheDocument();
    expect(screen.queryByText('Eesa Five')).not.toBeInTheDocument();
});

it('shows a group\'s students once the org and group are expanded', async () => {
    renderModal();
    await waitFor(() => expect(screen.getAllByText('Org A').length).toBeGreaterThan(0));

    userEvent.click(screen.getAllByText('Org A')[0]);
    userEvent.click(await screen.findByText('Grade 2'));

    expect(await screen.findByText('Careem Three')).toBeInTheDocument();
    expect(screen.queryByText('Eesa Five')).not.toBeInTheDocument();
});

it('checking a group targets every student in that group on save', async () => {
    renderModal();
    await waitFor(() => expect(screen.getAllByText('Org A').length).toBeGreaterThan(0));

    userEvent.click(screen.getAllByText('Org A')[0]);
    await screen.findAllByText('Grade 1');
    userEvent.click(groupCheckbox('Grade 1'));
    userEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect([...body.target_user_ids].sort()).toEqual(['a1', 'a2']);
    expect(body.target_groups).toEqual(['Org A:Grade 1']);
    expect(body.target_organizations).toEqual([]);
    expect(body.user_presence).toEqual({ a1: true, a2: true });
});

it('checking an org targets the whole org, including students with no group', async () => {
    renderModal();
    await waitFor(() => expect(screen.getAllByText('Org A').length).toBeGreaterThan(0));

    userEvent.click(groupCheckbox('Org A'));
    userEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect([...body.target_user_ids].sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(body.target_organizations).toEqual(['Org A']);
    expect(body.target_groups).toEqual([]);
});

it('lists groups in grade order in the selection, presence and viewer trees', async () => {
    mockedAxios.get.mockResolvedValue({
        data: {
            'Org A': [
                orgUser('a1', 'Aisha One', 'Org A', ['Grade 10']),
                orgUser('a2', 'Bilal Two', 'Org A', ['Grade 2']),
                orgUser('a3', 'Careem Three', 'Org A', []),
                orgUser('a4', 'Dawud Four', 'Org A', ['Grade 1']),
            ],
        },
    });
    renderModal();
    await waitFor(() => expect(screen.getAllByText('Org A').length).toBeGreaterThan(0));

    // select the org so it shows up under Presence too, then open it in every tree
    userEvent.click(groupCheckbox('Org A'));
    screen.getAllByText('Org A').forEach((el) => {
        if (el.closest('button')?.getAttribute('aria-expanded') !== 'true') userEvent.click(el);
    });

    const sorted = ['Grade 1', 'Grade 2', 'Grade 10', 'Not Assigned'];
    await waitFor(() =>
        expect(screen.getAllByText(/^(Grade \d+|Not Assigned)$/).map((el) => el.textContent)).toEqual([
            ...sorted,
            ...sorted,
            ...sorted,
        ])
    );
});
