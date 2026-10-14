import { render, waitFor } from '@testing-library/react';
import LoadSecret from '@/app/loadsecret/LoadSecret';
import globalConst from '@/constants';
import { emptyUser, useOpnVoteStore } from '@/opnVoteStore';

jest.mock('next-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('../../../src/components/ScanUploadQRCode', () => function ScanUploadQRCodeMock() {
    return null;
});

beforeEach(() => {
    window.history.replaceState({}, '', '/#loadkey');
    useOpnVoteStore.setState({
        user: {
            ...emptyUser,
            key: 'existing-security-key',
            keySavedAs: [],
        },
        page: {
            loading: false,
            previous: null,
            current: globalConst.pages.LOADKEY,
        },
    });
});

it('redirects to showkey when a key is already available', async () => {
    render(<LoadSecret />);

    await waitFor(() => {
        expect(useOpnVoteStore.getState().page.current).toBe(globalConst.pages.SHOWKEY);
    });

    expect(window.location.hash).toBe(`#${globalConst.pages.SHOWKEY}`);
});
