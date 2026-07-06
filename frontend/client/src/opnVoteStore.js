import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const splitStorage = {
    getItem: function (name) {
        let localData = JSON.parse(localStorage.getItem(name));
        if (!localData) {
            return localData;
        }
        localData.state = { ...localData.state, ...JSON.parse(sessionStorage.getItem(name)) };

        return localData;
    },
    setItem: function (name, value) {
        let { state: stateData, ...nonStateValue } = value;
        let { page: pageData, ...nonPageState } = stateData;

        sessionStorage.setItem(name, JSON.stringify({ page: pageData }));
        localStorage.setItem(name, JSON.stringify({ state: nonPageState, ...nonStateValue }));
    },
    removeItem: function (name) {
        localStorage.removeItem(name);
        sessionStorage.removeItem(name);
    },
};

export const emptyVoteClient = {};

export const emptyVoting = {
    electionId: null,
    election: {},
    electionInformation: {},
    jwt: '',
    registerCode: '',
    registerCodeSaved: false,
    registerCodeSavedAs: [],
    vote: {},
    revote: {},
    userCredential: '',
    votesuccess: false,
    transactionViewUrl: '',
    initElectionPermit: false,
};
export const emptyUser = {
    key: '',
    keySaved: false,
    keySavedAs: [],
    initKey: false,
};

export const modes = {
    replace: "replace",
    push: "push",
    none: "none",
};

export const emptyNotification = {
    targetPage: '',
    type: '',
    text: '',
}

export const emptyHashes = {
    userOpHash: '',
    txHash: '',
}

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: emptyUser,
            voting: emptyVoting,
            notification: emptyNotification,
            hashes: {
                userOpHash: '',
                txHash: '',
            },
            page: {
                loading: true,
                previous: null,
                current: null
            },
            voteClient: {},
            clearUser: () => set(() => ({ user: emptyUser })),
            updateUserKey: (key, keySaved) => set(() => ({
                user: {
                    ...get().user,
                    key: key,
                    keySaved: keySaved,
                }
            })),
            updateUser: (userData) =>
                set((state) => ({
                    user: {
                        ...state.user,
                        ...userData,
                    },
                })),
            updateNotification: (notificationData) =>
                set((state) => ({
                    notification: {
                        ...state.notification,
                        ...notificationData,
                    },
                })),
            clear: () => set((state) => ({
                user: emptyUser,
                voting: {
                    ...emptyVoting,
                    electionId: state.voting.electionId,
                    election: state.voting.election,
                    electionInformation: state.voting.electionInformation,
                },
                hashes: emptyHashes,
            })),
            updateVoting: (votingData) =>
                set((state) => ({
                    voting: {
                        ...state.voting,
                        ...votingData,
                    },
                })),
            updatePage: (updates, mode = modes.push) => {
                set(() => ({
                    page: { ...get().page, ...updates }
                }))
                if ("current" in updates) {
                    if (mode == modes.replace) {
                        history.replaceState({ current: updates.current }, "", "#" + updates.current);
                    } else if (mode == modes.push) {
                        history.pushState({ current: updates.current }, "", "#" + updates.current);
                    }
                }
            },
            updateHashes: (update) => set(() => ({
                hashes: update
            })),
            setVoteClient: (update) => set(() => ({
                voteClient: update
            })),
        }),
        {
            name: 'opnvote-storage',
            storage: splitStorage,
            partialize: (state) => ({
                user: state.user,
                voting: state.voting,
                taskId: state.taskId,
                hashes: state.hashes,
                page: state.page,
            }),
        }
    )
);