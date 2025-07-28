import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import globalConst from "@/constants";

export const emptyVoting = {
    electionId: null,
    election: {},
    electionInformation: {},
    jwt: '',
    registerCode: '',
    vote: {},
    revote: {},
    userCredential: '',
    votesuccess: false,
    transactionViewUrl: ''
};
export const emptyUser = {
    key: '',
    keySaved: false,
    initKey: false
};

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: emptyUser,
            voting: emptyVoting,
            taskId: '',
            page: {
                loading: true,
                previous: null,
                current: null
            },
            clearUser: () => set(() => ({ user: emptyUser })),
            updateUserKey: (key, keySaved, initKey) => set(() => ({
                user: {
                    ...get().user,
                    key: key,
                    keySaved: keySaved,
                    initKey: initKey
                    }
                })),
            updateVoting: (votingData) =>
                set((state) => ({
                    voting: {
                        ...state.voting,
                        ...votingData,
                    },
                })),
            updatePage: (updates) => set(() => ({
                page: { ...get().page, ...updates }
            })),
            updateTaskId: (update) => set(() => ({
                taskId: update
            })),
        }),
        {
            name: 'opnvote-storage',
        }
    ));
