import { create } from 'zustand';
import { persist } from 'zustand/middleware'

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: {
                key: ''
            },
            userelection: {
                election: {},
                jwt: {},
                ballotpaper: {},
                vote: {},
                revote: {}
            },
            updateUserKey: (key) => set(() => ({ user: { ...get().user, key: key } }))
        }),
        {
            name: 'opnvote-storage',
        }
    ));