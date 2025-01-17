'use client';
import { useEffect, useState } from 'react';
import { getElectionData } from '../service-graphql'
import { useOpnVoteStore } from '../opnVoteStore';
import { useTranslation } from 'next-i18next';
import Notification from "../components/Notification";

export default function DataLoad() {
    const [electionId, setElectionId] = useState();
    const [getElection, { data: dataElection, loading: loadingElection }] = getElectionData(electionId);
    const { t } = useTranslation();

    const [dataStationState, setDataStationState] = useState({
        showNotification: false,
        notificationText: '',
        notificationType: '',
    });

    const { voting, updateVoting } = useOpnVoteStore((state) => state);

    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        const jwtToken = queryParameters.get("jwt");
        const electionId = queryParameters.get("id");

        if (jwtToken && jwtToken.length > 0 && jwtToken != voting.jwt) {
            updateVoting({ jwt: jwtToken })
        }
        if (electionId && !isNaN(electionId) && electionId != voting.electionId) {
            setElectionId(electionId);
            updateVoting({ electionId: parseInt(electionId) });
            getElection();
        }
    }, []);

    useEffect(() => {
        if (loadingElection) return;
        let election, electionInformation;
        if (dataElection && dataElection?.election && Object.keys(dataElection?.election).length > 0) {
            election = dataElection.election;
            electionInformation = JSON.parse(dataElection.election?.descriptionBlob);
            updateVoting({ election: election, electionInformation: electionInformation });
        }
    }, [dataElection]);

    //TODO: add notification in error case
    return (
        <></>
    );
}
