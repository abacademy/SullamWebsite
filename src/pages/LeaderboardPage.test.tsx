import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { ChakraProvider } from '@chakra-ui/react';
import LeaderboardPage from './LeaderboardPage';
import { UserContext } from '../utils/UserContext';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        put: jest.fn(),
        create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } })),
    },
}));
jest.mock(
    'react-router-dom',
    () => ({ useNavigate: () => jest.fn(), useParams: () => ({ id: 'lb1' }) }),
    { virtual: true }
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

const SCORES = [
    { user_id: 's1', full_name: 'Aisha One', schoolteacher: 'Ustadh Kareem', NewPoints: 550, OldPoints: 0, TotalPoints: 550 },
    { user_id: 's2', full_name: 'Bilal Two', schoolteacher: null, NewPoints: 0, OldPoints: 1100, TotalPoints: 1100 },
];
const META = { _id: 'lb1', name: 'Jalseh', end_time: '2099-01-01T00:00:00Z', user_presence: { s1: true, s2: true } };
const ORG_USERS = { 'Org A': [{ _id: { $oid: 's2' }, full_name: 'Bilal Two', schoolteacher: 'Ustadha Maryam' }] };

const orgUserCalls = () =>
    mockedAxios.get.mock.calls.filter(([url]) => String(url).endsWith('/user/list_my_org_users')).length;

function renderPage() {
    const ctx = { user: { _id: 'admin' }, setUser: () => {}, isLoading: false, isAuthenticated: true, logout: () => {} };
    return render(
        <ChakraProvider>
            <UserContext.Provider value={ctx}>
                <LeaderboardPage />
            </UserContext.Provider>
        </ChakraProvider>
    );
}

beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.get.mockImplementation((url: string) => {
        if (url.endsWith('/user/list_my_org_users')) return Promise.resolve({ data: ORG_USERS });
        if (url.endsWith('/leaderboard/get/lb1')) return Promise.resolve({ data: META });
        return Promise.resolve({ data: SCORES.map((s) => ({ ...s })) });
    });
});

it('does not download every org user just to view a leaderboard', async () => {
    renderPage();
    await screen.findByLabelText('Teacher Summary');

    expect(orgUserCalls()).toBe(0);
});

it('loads org users once when Teacher Summary is opened, and uses them as the teacher fallback', async () => {
    renderPage();
    const toggle = await screen.findByLabelText('Teacher Summary');

    userEvent.click(toggle);
    expect(await screen.findByText('Ustadha Maryam')).toBeInTheDocument();
    expect(screen.getByText('Ustadh Kareem')).toBeInTheDocument();

    userEvent.click(toggle);
    userEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('Ustadha Maryam')).toBeInTheDocument());
    expect(orgUserCalls()).toBe(1);
});
