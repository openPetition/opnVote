import { create } from 'zustand';
import { persist } from 'zustand/middleware'

export const useOpnVoteStore = create(
    persist(
        (set, get) => ({
            user: {
                key: ''
            },
            voting: {
                electionId: null,
                election: {},
                jwt: '',
                ballotpaper: {},
                vote: {},
                revote: {}
            },
            updateUserKey: (key) => set(() => ({ user: { ...get().user, key: key } })),
            updateVoting: (updates) => set(() => ({
                voting: { ...get().voting, ...updates }
            })),
        }),
        {
            name: 'opnvote-storage',
        }
    ));