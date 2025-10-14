'use client';

import { useEffect, useState } from 'react';
import globalConst from "@/constants";
import { getElectionData } from '@/service-graphql';
import { useOpnVoteStore, emptyVoting, modes } from '@/opnVoteStore';
import { parseJwt } from '@/util';

export default function DataLoad() {
    const [localState, setLocalState] = useState({
        electionId: null,
        election: {},
        electionInformation: {},
        jwt: '',
        fragment: '',
        updateElection: false,
        updatePage: false,
    });

    const [getElection, { data: dataElection, loading: loadingElection }] = getElectionData(localState.electionId);
    const { voting, updateVoting, page, updatePage, user, clearUser, updateTaskId } = useOpnVoteStore((state) => state);

    useEffect(() => {
        const onHashChange = (event) => {
            const fragment = window.location.hash.substring(1) || '';
            if (Object.values(globalConst.pages).includes(fragment) ) {
                updatePage({ current: fragment }, modes.none);
            }
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // onHashChange seems to be enough, but it might be too fragile if the actual URL changes?
    //useEffect(() => {
    //    const onPopState = (event) => {
    //        console.log(event);
    //        if (Object.values(globalConst.pages).includes(event.state?.current)) {
    //            updatePage({ current: event.state.current }, modes.none);
    //        }
    //    };
    //    window.addEventListener('popstate', onPopState);
    //    return () => window.removeEventListener('popstate', onPopState);
    //}, []);

    // get Params and check wethere electionId is given. Continue or Error
    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        const electionIdParam = queryParameters.get("id");
        const fragment = window.location.hash.substring(1) || '';
        const jwt = queryParameters.get("jwt") || '';

        if (electionIdParam && !isNaN(electionIdParam)) {
            setLocalState({
                ...localState,
                electionId: parseInt(electionIdParam),
                jwt: jwt,
                fragment: fragment,
            });
        } else {
            updatePage({ current: globalConst.pages.OVERVIEW, loading: false });
            return;
        }
    }, []);

    //check by electionId wether electionData has to be updated or can be taken from existing store
    useEffect(() => {
        if (localState.electionId != null) {
            if (localState.electionId != voting.electionId) {
                getElection();
            } else {
                setLocalState({
                    ...localState,
                    updatePage: true,
                });
            }
        }
    }, [localState.electionId]);

    useEffect(() => {
        if (loadingElection) return;
        if (dataElection && dataElection?.election && Object.keys(dataElection?.election).length > 0) {
            let election = dataElection.election;
            if (election.id == 15) {
                // hard coded end time, since the graphql data is temporarily outdated
                election = {...dataElection.election, votingEndTime: "1761692399"};
            }
            setLocalState({
                ...localState,
                updatePage: true,
                updateElection: true,
                election: election,
                electionInformation: JSON.parse(dataElection.election?.descriptionBlob)
            });
        }
    }, [dataElection]);

    // update everything in one step
    useEffect(() => {
        if (localState.updatePage) {
            let votingUpdate = {
                electionId: localState.electionId,
                jwt: localState.jwt,
                election: localState.updateElection ? localState.election : voting.election,
                electionInformation: localState.updateElection ? localState.electionInformation : voting.electionInformation,
            };

            let oldJwt = parseJwt(voting.jwt);
            let newJwt = parseJwt(localState.jwt);

            if (newJwt && (newJwt?.voterId != oldJwt?.voterId || newJwt?.electionId != oldJwt?.electionId)) {
                // drop information about the user
                clearUser();
                // overwrite current voting data with emptyVoting data (votingUpdate was only partial update until now)
                votingUpdate = {
                    ...emptyVoting,
                    ...votingUpdate,
                };
                // remove any possibly stored task id, @todo: why isn't this part of voting?
                updateTaskId('');
                // if a fragment is given, we switch to that page, regardless of user/election changes, overview otherwise
                let targetPage = localState.fragment && Object.values(globalConst.pages).includes(localState.fragment)
                    ? localState.fragment
                    : globalConst.pages.OVERVIEW;
                updatePage({ current: targetPage });
            }

            updateVoting(votingUpdate);

            if (Object.values(globalConst.pages).includes(localState.fragment)) {
                updatePage({ current: localState.fragment, loading: false });
            } else {
                if (localState.jwt) { // jwt Token is needed for other page
                    if (!page.current || page.current === "pollingstation") {
                        if (!user.key) {
                            updatePage({ previous: globalConst.pages.POLLINGSTATION, current: globalConst.pages.CREATEKEY });
                        } else if (!voting.registerCode) {
                            updatePage({ previous: globalConst.pages.POLLINGSTATION, current: globalConst.pages.SHOWKEY });
                        }
                    }
                    updatePage({ loading: false });
                } else {
                    updatePage({ current: globalConst.pages.OVERVIEW, loading: false });
                }
            };
        }
    }, [localState.updatePage]);

    useEffect(() => {
        window.scroll(0, 0);
    }, [page.current]);

    //TODO: add notification in error case
    return (
        <></>
    );
}
