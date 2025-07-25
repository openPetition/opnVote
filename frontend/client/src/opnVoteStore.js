import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import globalConst from "@/constants";

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: {
                key: '',
                keySaved: false,
                initKey: false
            },
            voting: {
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
            },
            taskId: '',
            page: {
                loading: true,
                previous: null,
                current: null
            },
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
