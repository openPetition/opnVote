'use client';
import { useEffect, useState } from 'react';
import globalConst from "@/constants";
import { getElectionData } from '@/service-graphql';
import { useOpnVoteStore, emptyVoting } from '@/opnVoteStore';
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
            setLocalState({
                ...localState,
                updatePage: true,
                updateElection: true,
                election: dataElection.election,
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

            if (newJwt?.voterId != oldJwt?.voterId || newJwt?.electionId != oldJwt?.electionId) {
                // drop information about the user
                clearUser();
                // overwrite current voting data with emptyVoting data (votingUpdate was only partial update until now)
                votingUpdate = {
                    ...emptyVoting,
                    ...votingUpdate,
                };
                // remove any possibly stored task id, @todo: why isn't this part of voting?
                updateTaskId('');
                updatePage({ current: globalConst.pages.OVERVIEW });
            }

            updateVoting(votingUpdate);

            if (localState.fragment == 'pollingstation') {
                updatePage({ current: globalConst.pages.POLLINGSTATION, loading: false });
            } else if (localState.fragment == 'overview') {
                updatePage({ current: globalConst.pages.OVERVIEW, loading: false });
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
