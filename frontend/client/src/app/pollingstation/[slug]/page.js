'use client';

import React, { useState, useEffect } from "react";
import Cookies from 'universal-cookie';
import Alert from "../../../components/Alert";
import Button from '../../../components/Button';
import NavigationBox from '../../../components/NavigationBox';
import HtmlQRCodePlugin from "../../../components/ScanUploadQRCode";
import Electionheader from "../components/Electionheader";
import Question from "../components/Question";
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { useLazyQuery, gql } from '@apollo/client';

export default function Home({ params }) {

    const pollingStationManagerInit = {
        showElectionInformation: false,
        showElection: false,
        showVotingSlipUpload: false,
        showNotification: false,
        showVotingSlipSelection: false,
        showNotification: false,
        showQuestions: false,
        allowedToVote: false,
        notificationText: '',
        notificationType: ''
    }

    const cookies = new Cookies(null, { path: '/' });
    const [ votingCredentials, setVotingCredentials ] = useState({});
    const [ electionInformations, setElectionInformations ] = useState({});

    // manages what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [ pollingStationManager, setPollingStationManager ] = useState(pollingStationManagerInit);

    const GET_ELECTION = gql`
        query election($id: ID!) {
        election(id: $id)  {
        id,
        startTime,
        endTime,
        transactionHash,
        totalVotes,
        registeredVoterCount,
        authorizedVoterCount,
        status,
        descriptionCID, # ist nun dynamisch
        descriptionBlob, # ist nun dynamisch
        publicKey, # hinzugefuegt
        }
    }`;

    const registerForElection = function() {
        if(data?.election.id) {
            window.location.href="/register/"+data?.election.id;
        }
    }

    const qrCodeToCredentials = async (code) => {
        try {
            let credentials = await qrToElectionCredentials(code);

            if (Object.keys(credentials).length > 0) {
                await validateCredentials(credentials);
                if (parseInt(credentials?.electionID) !== parseInt(data?.election.id)) {
                    setPollingStationManager({
                        ...pollingStationManager,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: false,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: true,
                        allowedToVote: false,
                        showNotification: true,
                        notificationText: 'Die Daten des gespeicherten Wahlscheins passen nicht zu dieser Wahl.',
                        notificationType: 'error'
                    });
                } else {
                    setVotingCredentials(credentials);
                    setPollingStationManager({
                        ...pollingStationManager,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: true,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: false,
                        showNotification: true,
                        allowedToVote: true,
                        notificationType: 'note',
                        notificationText: 'Ihr Wahlschein für diese Wahl wurde anerkannt. Sie können jetzt Ihre Auswahl treffen.'
                    })
                }
            }
        } catch(err) {
            setPollingStationManager({
                ...pollingStationManager,
                showElection: false,
                showQuestions: true,
                showVotingSlipUpload: false,
                showVotingSlipSelection: true,
                showNotification: true,
                notificationText: 'Die Daten dieses Wahlscheins konnten nicht verarbeitet werden.',
                notificationType: 'error'
            });
        }
    }

    const [getElection, { loading, data }]  = useLazyQuery(GET_ELECTION, { variables: { id: params.slug } });

    const setNoElectionData = () => {
        setPollingStationManager({
            ...pollingStationManager,
            showNotification: true,
            notificationText: 'Es wurden keine Wahldaten gefunden.',
            notificationType: 'error'
        })
    }

    useEffect(() => {
        // everything that we need to do first is get the election data
        getElection();
    }, []);

    useEffect(() => {
        // after we got election data .. check this
        if (data && data?.election && Object.keys(data?.election).length > 0) {
            setElectionInformations(JSON.parse(data.election?.descriptionBlob));
            setPollingStationManager({
                showElectionInformation: true,
                showQuestions: true,
                showElection: false,
                showVotingSlipUpload: false,
                showNotification: false,
                showVotingSlipSelection: true,
                showNotification: false,
                notificationText: '',
                notificationType: ''
            });
        } else {
            if(!loading)
                setNoElectionData();
        }
    }, [data]);

    useEffect(() => {
        // only if we have the electioninformations its worth to check wether there is some voter informations stored.
        let voterQR = cookies.get('voterQR');
        if(voterQR?.length > 0) {
            qrCodeToCredentials(voterQR);
        }
    }, [electionInformations])

    return (
        <>
            {pollingStationManager.showElectionInformation && (
                <Electionheader
                    election={data?.election}
                    electionInformations={electionInformations}
                />
            )}
            {pollingStationManager.showNotification && (
                <>
                    <Alert
                        alertType={pollingStationManager.notificationType}
                        alertText={pollingStationManager.notificationText}
                    />
                </>
            )}

            {pollingStationManager.showQuestions && (
                <>
                    {electionInformations.ballot.map((question, index) =>
                        <Question
                            key = {index}
                            question = {question}
                        />
                    )}
                </>
            )}

            {pollingStationManager.showVotingSlipSelection && (
                <>
                    <div className="op__contentbox_760 op__padding_standard_top_bottom">
                        <h4>Zur Abstimmung benötigen Sie einen Wahlschein</h4>
                    </div>
                    <div>
                        <NavigationBox
                            onClickAction={() => registerForElection()}
                            head="Wahlschein bestellen"
                            text="Ich habe noch keinen Wahlschein und möchte einen bestellen"
                            type="primary"
                        />
                    </div>
                    <div>
                        <NavigationBox
                            onClickAction={() =>
                                setPollingStationManager({
                                    ...pollingStationManager,
                                    showVotingSlipUpload: true,
                                    showVotingSlipSelection: false,
                                    showQuestions: false,
                                    showNotification: false,
                                })
                            }
                            head="Direkt abstimmen"
                            text="Ich habe meinen Wahlschein und möchte direkt abstimmen"
                            type="primary"
                        />
                    </div>
                </>
            )}
            {pollingStationManager.showVotingSlipUpload && (
                <>
                    <HtmlQRCodePlugin
                        headline = "Wahlschein prüfen"
                        subheadline = "Mithilfe des Wahlscheins prüft die Wahlleitung Ihre Wahlberechtigung.!"
                        uploadSubHeadline = "Sie können Ihren Wahlschein ganz einfach hier als Bild laden und prüfen lassen."
                        scanSubHeadline = "Sie können Ihren Wahlschein ganz einfach über Ihre Geräte-Kamera prüfen lassen."
                        onResult={(res) => {
                            qrCodeToCredentials(res)
                        }}
                    />

                    <div className="op__contentbox_760 op__center_align">
                        <Button
                            onClickAction={() =>
                                setPollingStationManager({
                                    ...pollingStationManager,
                                    showVotingSlipUpload: false,
                                    showQuestions: true,
                                    showVotingSlipSelection: true,
                                })
                            }
                            text="Eingabe abbrechen"
                            type="primary"
                        />
                    </div>

                </>
            )}
            {pollingStationManager.showElection && pollingStationManager.allowedToVote && (
                <>
                    <div>
                        Wahlschein erkannt. Weitermachen mit dem nächsten Ticket
                    </div>
                </>
            )}
        </>
    );
}
