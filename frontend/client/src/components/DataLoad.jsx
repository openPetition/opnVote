'use client';
import { useEffect, useState } from 'react';
import globalConst from "@/constants";
import { getElectionData } from '@/service-graphql';
import { useOpnVoteStore } from '@/opnVoteStore';

export default function DataLoad() {
    const [dataStationState, setDataStationState] = useState({
        electionId: null,
        election: {},
        electionInformation: {},
        jwtToken: '',
        linkedPage: '',
        updateElection: false,
        updatePage: false,
    });

    const [getElection, { data: dataElection, loading: loadingElection }] = getElectionData(dataStationState.electionId);
    const { voting, updateVoting, page, updatePage, user } = useOpnVoteStore((state) => state);

    // get Params and check wethere electionId is given. Continue or Error
    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        const electionIdParam = queryParameters.get("id");
        const linkedPage = window.location.hash.substring(1);
        const jwtToken = queryParameters.get("jwt");

        if (electionIdParam && !isNaN(electionIdParam)) {
            setDataStationState({
                ...dataStationState,
                electionId: parseInt(electionIdParam),
                jwtToken: jwtToken?.length > 0 ? jwtToken : '',
                linkedPage: linkedPage,
            });
        } else {
            updatePage({ current: globalConst.pages.ERROR, loading: false });
            return;
        }
    }, []);

    //check by electionId wether electionData has to be updated or can be taken from existing store
    useEffect(() => {
        if (dataStationState.electionId != null) {
            if (dataStationState.electionId != voting.electionId) {
                getElection();
            } else {
                setDataStationState({
                    ...dataStationState,
                    updatePage: true,
                });
            }
        }
    }, [dataStationState.electionId]);

    useEffect(() => {
        if (loadingElection) return;
        if (dataElection && dataElection?.election && Object.keys(dataElection?.election).length > 0) {
            setDataStationState({
                ...dataStationState,
                updatePage: true,
                updateElection: true,
                election: dataElection.election,
                electionInformation: JSON.parse(dataElection.election?.descriptionBlob)
            });
        }
    }, [dataElection]);

    // update everything in one step
    useEffect(() => {
        if (dataStationState.updatePage) {
            updateVoting({
                electionId: dataStationState.electionId,
                jwt: dataStationState.jwtToken.length > 0 ? dataStationState.jwtToken : '',
                election: dataStationState.updateElection ? dataStationState.election : voting.election,
                electionInformation: dataStationState.updateElection ? dataStationState.electionInformation : voting.electionInformation,
            });

            if (dataStationState.linkedPage && dataStationState.linkedPage == 'pollingstation') {
                updatePage({ current: globalConst.pages.POLLINGSTATION, loading: false });
            } else if (dataStationState.linkedPage && dataStationState.linkedPage == 'overview') {
                updatePage({ current: globalConst.pages.OVERVIEW, loading: false });
            } else {
                if (dataStationState.jwtToken.length > 0) { // jwt Token is needed for other page
                    if (!page.current || page.current === "pollingstation") {
                        if (!user.key) {
                            updatePage({ previous: globalConst.pages.POLLINGSTATION, current: globalConst.pages.CREATEKEY });
                        } else if (!voting.registerCode) {
                            updatePage({ previous: globalConst.pages.POLLINGSTATION, current: globalConst.pages.SHOWKEY });
                        }
                    }
                    updatePage({ loading: false });
                } else {
                    updatePage({ current: globalConst.pages.ERROR, loading: false });
                }
            };
        }
    }, [dataStationState.updatePage]);

    useEffect(() => {
        window.scroll(0, 0);
    }, [page.current]);

    //TODO: add notification in error case
    return (
        <></>
    );
}
