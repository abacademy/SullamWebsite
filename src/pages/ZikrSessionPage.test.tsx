import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { ChakraProvider } from '@chakra-ui/react';
import { ZikrSessionContent } from './ZikrSessionPage';
import { UserContext } from '../utils/UserContext';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } })),
    },
}));
jest.mock(
    'react-router-dom',
    () => ({ useNavigate: () => jest.fn(), useParams: () => ({ id: 's1' }) }),
    { virtual: true }
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

const detail = (over: object = {}) => ({
    id: 's1',
    name: 'Friday Salawat',
    organizations: ['a'],
    target: 1000,
    total: 300,
    contributors: 1,
    createdBy: 'Teacher',
    isMine: false,
    canManage: false,
    closed: false,
    createdAt: null,
    myCount: 0,
    entries: [{ name: 'Other', count: 300, isMe: false }],
    ...over,
});

let server: any;

function renderPage() {
    const ctx = { user: { full_name: 'Me' }, setUser: () => {}, isLoading: false, isAuthenticated: true, logout: () => {} };
    return render(
        <ChakraProvider>
            <UserContext.Provider value={ctx}>
                <ZikrSessionContent />
            </UserContext.Provider>
        </ChakraProvider>
    );
}

const total = () => screen.getByTestId('zikr-total').textContent;

beforeEach(() => {
    server = detail();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockImplementation(() => Promise.resolve({ data: server }));
    mockedAxios.post.mockImplementation((_url: string, body: any) => {
        server = detail({
            total: server.total + body.amount,
            myCount: server.myCount + body.amount,
            entries: [...server.entries.filter((e: any) => !e.isMe), { name: 'Me', count: server.myCount + body.amount, isMe: true }],
        });
        return Promise.resolve({ data: server });
    });
});

test('shows the shared total, target and contributions', async () => {
    renderPage();
    expect(await screen.findByText('Friday Salawat')).toBeInTheDocument();
    expect(total()).toBe('300');
    expect(screen.getByText(/of 1,000 target/)).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
});

test('+ buttons add to the total and send the amount', async () => {
    renderPage();
    await screen.findByText('Friday Salawat');
    await userEvent.click(screen.getByRole('button', { name: '+250' }));
    expect(total()).toBe('550');
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringMatching(/\/zikr\/sessions\/s1\/count$/), { amount: 250 }, expect.anything());
    expect(await screen.findByText('Me (you)')).toBeInTheDocument();
});

test('minus buttons are disabled until you have added something', async () => {
    renderPage();
    await screen.findByText('Friday Salawat');
    expect(screen.getByRole('button', { name: '−50' })).toBeDisabled();
});

test('subtract never takes you below zero', async () => {
    server = detail({ total: 400, myCount: 100, entries: [{ name: 'Other', count: 300, isMe: false }, { name: 'Me', count: 100, isMe: true }] });
    renderPage();
    await screen.findByText('Friday Salawat');
    await userEvent.click(screen.getByRole('button', { name: '−1000' }));
    expect(total()).toBe('300');
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.anything(), { amount: -100 }, expect.anything());
});

test('custom amount adds the typed number', async () => {
    renderPage();
    await screen.findByText('Friday Salawat');
    await userEvent.type(screen.getByPlaceholderText('Custom amount'), '33');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(total()).toBe('333');
    expect(mockedAxios.post).toHaveBeenCalledWith(expect.anything(), { amount: 33 }, expect.anything());
});

test('closed sessions disable counting', async () => {
    server = detail({ closed: true });
    renderPage();
    expect(await screen.findByText(/This session is closed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+50' })).toBeDisabled();
});
