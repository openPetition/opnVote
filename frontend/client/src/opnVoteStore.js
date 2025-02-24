import { create } from 'zustand';
import { persist } from 'zustand/middleware'
import globalConst from "@/constants";

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: {
                key: ''
            },
            voting: {
                electionId: null,
                election: {},
                electionInformation: {},
                jwt: '',
                ballotpaper: {},
                vote: {},
                revote: {}
            },
            page: {
                current: globalConst.pages.LOADING
            },
            updateUserKey: (key) => set(() => ({ user: { ...get().user, key: key } })),
            updateVoting: (updates) => set(() => ({
                voting: { ...get().voting, ...updates }
            })),
            updatePage: (updates) => set(() => ({
                page: { ...get().page, ...updates }
            }))
        }),
        {
            name: 'opnvote-storage',
        }
    ));
