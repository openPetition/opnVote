import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import globalConst from "@/constants";

/**
 * the split storage will extract the "page" entry from the state object given to the storage and
 * store it separately. the rest of the state is stored in localStorage while the page entry is
 * stored in the sessionStorage
 *
 * the logic for that is quite verbose and it requires every part of the state to be
 * JSON-serializable, but that's also true for the former version, as far as I can tell
 */
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
        let {state: stateData, ...nonStateValue} = value;
        let {page: pageData, ...nonPageState} = stateData;

        sessionStorage.setItem(name, JSON.stringify({page: pageData}));
        localStorage.setItem(name, JSON.stringify({state: nonPageState, ...nonStateValue}));
    },
    removeItem: function (name) {
        localStorage.removeItem(name);
        sessionStorage.removeItem(name);
    },
};

export const emptyVoting = {
    electionId: null,
    election: {},
    electionInformation: {},
    jwt: '',
    registerCode: '',
    registerCodeSaved: false,
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
    initKey: false,
};

export const modes = {
    replace: "replace",
    push: "push",
    none: "none",
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
            clear: () => set((state) => ({
                user: emptyUser,
                voting: {
                    ...emptyVoting,
                    electionId: state.voting.electionId,
                    election: state.voting.election,
                    electionInformation: state.voting.electionInformation,
                },
                taskId: '',
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
            updateTaskId: (update) => set(() => ({
                taskId: update
            })),
        }),
        {
            name: 'opnvote-storage',
            storage: splitStorage,
        }
    )
);
