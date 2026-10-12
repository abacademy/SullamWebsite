import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { ChakraProvider } from '@chakra-ui/react';
import ExportData from './ExportData';
import { UserContext } from '../utils/UserContext';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } })),
    },
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

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

function renderPage() {
    const ctx = { user: { _id: 'admin' }, setUser: () => {}, isLoading: false, isAuthenticated: true, logout: () => {} };
    return render(
        <ChakraProvider>
            <UserContext.Provider value={ctx}>
                <ExportData />
            </UserContext.Provider>
        </ChakraProvider>
    );
}

const headerCheckbox = (name: string) =>
    within(screen.getAllByText(name)[0].closest('button') as HTMLElement).getByRole('checkbox', { hidden: true });

beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockResolvedValue({ data: ORG_USERS });
});

it('does not mount student rows while their group is collapsed', async () => {
    renderPage();
    await screen.findByText('Org A');

    expect(screen.queryByText('Aisha One')).not.toBeInTheDocument();
    expect(screen.queryByText('Eesa Five')).not.toBeInTheDocument();
});

it('shows a group\'s students once the org and group are expanded', async () => {
    renderPage();
    userEvent.click(await screen.findByText('Org A'));
    userEvent.click(await screen.findByText('Not Assigned'));

    expect(await screen.findByText('Dawud Four')).toBeInTheDocument();
    expect(screen.queryByText('Aisha One')).not.toBeInTheDocument();
});

it('loads data for every student of a checked group and previews school/home columns', async () => {
    mockedAxios.post.mockResolvedValue({
        data: {
            results: [
                { user_id: 'a1', name: 'Aisha One', data: { new_pages_school: 2, new_pages_home: 3 } },
                { user_id: 'a2', name: 'Bilal Two', data: { new_pages_school: 4 } },
            ],
        },
    });
    renderPage();
    userEvent.click(await screen.findByText('Org A'));
    await screen.findAllByText('Grade 1');
    userEvent.click(headerCheckbox('Grade 1'));
    userEvent.click(within(screen.getByText('New Pages').parentElement as HTMLElement).getByRole('checkbox'));
    userEvent.click(screen.getByText('🔄 Load Data'));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect([...body.user_ids].sort()).toEqual(['a1', 'a2']);

    expect(await screen.findByText('New Pages (School)')).toBeInTheDocument();
    expect(screen.getByText('New Pages (Home)')).toBeInTheDocument();
    const bilalRow = screen.getAllByText('Bilal Two').map((el) => el.closest('tr')).find(Boolean) as HTMLElement;
    expect(within(bilalRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Bilal Two', '4', '0']);
});
