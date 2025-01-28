'use client';

import React, { useState, useEffect } from "react";
import Cookies from 'universal-cookie';
import Notification from "../../components/Notification";
import Button from '../../components/Button';
import NavigationBox from '../../components/NavigationBox';
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import VoteTransactionState from "./components/VoteTransactionState";
import Electionheader from "./components/Electionheader";
import Question from "./components/Question";
import { getElectionData, getVoteCastsData } from '../../service-graphql';
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { sendVotes } from "./sendVotes";
import { useTranslation } from 'next-i18next';
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";

export default function Pollingstation() {
    const { updatePage } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const cookies = new Cookies(null, { path: '/' });
    const [votingCredentials, setVotingCredentials] = useState({});
    const [electionInformations, setElectionInformations] = useState({});
    const [votes, setVotes] = useState({});
    const [electionId, setElectionId] = useState();

    const [getElection, { data: dataElection, loading: loadingElection }] = getElectionData(electionId);
    const [getVoteCasts, { data: dataVotings, loading: loadingVotings }] = getVoteCastsData(votingCredentials?.voterWallet?.address, electionId);

    // manages what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [pollingStationState, setPollingStationState] = useState({
        taskId: '',
        showElectionInformation: false,
        showElection: false,
        showVotingSlipUpload: false,
        showVotingSlipSelection: false,
        showNotification: false,
        showQuestions: false,
        showSendError: false,
        pending: false,
        allowedToVote: false,
        notificationText: '',
        notificationType: '',
        isVoteRecast: false
    });

    const registerForElection = function () {
        updatePage({ current: globalConst.pages.REGISTER });
    };

    const saveVotes = async () => {
        setPollingStationState({ ...pollingStationState, pending: true });
        //result will be changed still ! we have to work with result (error notes.. redirect or sth else..)
        try {
            const taskId = await sendVotes(votes, votingCredentials, dataElection.election.publicKey, pollingStationState.isVoteRecast);
            if (taskId) {
                cookies.remove('voterQR');
                setPollingStationState({
                    ...pollingStationState,
                    taskId: taskId,
                    showElectionInformation: false,
                    showQuestions: false,
                    showElection: false,
                    showVotingSlipUpload: false,
                    showVotingSlipSelection: false,
                    allowedToVote: false,
                    showNotification: false,
                    pending: false,
                });
            }
        } catch (e) {
            setPollingStationState({
                ...pollingStationState,
                showSendError: t('pollingstation.button.errormessage'),
                allowedToVote: true,
                pending: true,
            });
            setTimeout(() => {
                setPollingStationState({ ...pollingStationState, pending: false });
            }, 10000);
        }
    };

    const qrCodeToCredentials = async (code) => {
        try {
            let credentials = await qrToElectionCredentials(code);

            if (Object.keys(credentials).length > 0) {
                await validateCredentials(credentials);
                if (parseInt(credentials?.electionID) !== parseInt(dataElection?.election.id)) {
                    setPollingStationState({
                        ...pollingStationState,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: false,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: true,
                        allowedToVote: false,
                        showNotification: true,
                        notificationText: t("pollingstation.notification.error.ballotnotfitting"),
                        notificationType: 'error'
                    });
                } else {
                    setVotingCredentials(credentials);
                    setPollingStationState({
                        ...pollingStationState,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: true,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: false
                    });
                }
            }
        } catch (err) {
            setPollingStationState({
                ...pollingStationState,
                showElection: false,
                showQuestions: true,
                showVotingSlipUpload: false,
                showVotingSlipSelection: true,
                showNotification: true,
                notificationText: t("pollingstation.notification.error.ballotdatacorrupt"),
                notificationType: 'error'
            });
        }
    };

    const setNoElectionData = () => {
        setPollingStationState({
            ...pollingStationState,
            showNotification: true,
            notificationText: t("pollingstation.notification.error.noelectiondatafound"),
            notificationType: 'error'
        });
    };

    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        setElectionId(queryParameters.get("id"));
        getElection();
    }, []);

    useEffect(() => {
        if (loadingElection) return;

        // after we got election data .. check this
        if (dataElection && dataElection?.election && Object.keys(dataElection?.election).length > 0) {
            setElectionInformations(JSON.parse(dataElection.election?.descriptionBlob));
            setPollingStationState({
                ...pollingStationState,
                showElectionInformation: true,
                showQuestions: true,
                showElection: false,
                showVotingSlipUpload: false,
                allowedToVote: false,
                showVotingSlipSelection: true,
                showNotification: false,
                notificationText: '',
                notificationType: ''
            });
        } else {
            setNoElectionData();
        }
    }, [dataElection]);

    useEffect(() => {
        if (loadingVotings) return;

        if (dataVotings && dataVotings?.voteUpdateds && Object.keys(dataVotings?.voteUpdateds).length >= Config.env.maxVoteRecasts) {
            setPollingStationState({
                ...pollingStationState,
                allowedToVote: false,
                showNotification: true,
                notificationText: 'Eine Änderung der Stimmabgabe ist nicht mehr möglich',
                notificationType: 'error',
                showVotingSlipUpload: false,
                showVotingSlipSelection: false,
            });
            return;
        }

        let isVoteRecast = false;
        // after we got voteCasts data .. check this
        if (dataVotings && dataVotings?.voteCasts && Object.keys(dataVotings?.voteCasts).length > 0) {
            isVoteRecast = true;
        }

        setPollingStationState({
            ...pollingStationState,
            allowedToVote: true,
            isVoteRecast: isVoteRecast,
            showNotification: true,
            notificationType: 'success',
            notificationText: t("pollingstation.notification.success.ballotfits")
        });
    }, [dataVotings]);

    useEffect(() => {
        // only if we have the electioninformations its worth to check
        // wether there is some voter informations stored.
        let voterQR = cookies.get('voterQR');
        if (typeof voterQR === "undefined" || voterQR?.length == 0 || Object.keys(electionInformations).length === 0 || electionInformations.constructor !== Object) {
            return;
        }
        qrCodeToCredentials(voterQR);

    }, [electionInformations]);

    useEffect(() => {
        // here we have to see wether voter already voted to prepare for vote-recast
        if (Object.keys(votingCredentials).length > 0 && electionId && Object.keys(electionInformations).length > 0) {
            getVoteCasts();
        }

    }, [votingCredentials]);

    return (
        <>
            {pollingStationState.showElectionInformation && (
                <Electionheader
                    election={dataElection?.election}
                    electionInformations={electionInformations}
                />
            )}

            <div className="op__contentbox_760">
                {pollingStationState.showNotification && (
                    <>
                        <Notification
                            type={pollingStationState.notificationType}
                            text={pollingStationState.notificationText}
                        />
                    </>
                )}

                {pollingStationState.showQuestions && (
                    <>
                        {electionInformations.ballot.map((question, index) =>
                            <Question
                                key={index}
                                questionKey={index}
                                question={question}
                                selectedVote={votes[index]}
                                showVoteOptions={pollingStationState.allowedToVote}
                                setVote={(selection) => setVotes(votes => ({
                                    ...votes,
                                    [index]: selection
                                }))}
                            />
                        )}
                    </>
                )}

                {pollingStationState.showVotingSlipSelection && (
                    <>
                        <div className="op__padding_standard_top_bottom">
                            <h4>{t("pollingstation.headline.ballotneeded")}</h4>
                        </div>
                        <div>
                            <NavigationBox
                                onClickAction={() => registerForElection()}
                                head={t("pollingstation.navigationbox.registerforelection.head")}
                                text={t("pollingstation.navigationbox.registerforelection.text")}
                                type="primary"
                            />
                        </div>
                        <div>
                            <NavigationBox
                                onClickAction={() =>
                                    setPollingStationState({
                                        ...pollingStationState,
                                        showVotingSlipUpload: true,
                                        showVotingSlipSelection: false,
                                        showQuestions: false,
                                        showNotification: false,
                                    })
                                }
                                head={t("pollingstation.navigationbox.continuetovote.head")}
                                text={t("pollingstation.navigationbox.continuetovote.text")}
                                type="primary"
                            />
                        </div>
                    </>
                )}
                {pollingStationState.showVotingSlipUpload && (
                    <>
                        <HtmlQRCodePlugin
                            headline={t("pollingstation.uploadqrcode.headline")}
                            subheadline={t("pollingstation.uploadqrcode.subheadline")}
                            uploadSubHeadline={t("pollingstation.uploadqrcode.uploadSubHeadline")}
                            scanSubHeadline={t("pollingstation.uploadqrcode.scanSubHeadline")}
                            onResult={(res) => {
                                qrCodeToCredentials(res);
                            }}
                        />

                        <div className="op__center_align">
                            <Button
                                onClickAction={() =>
                                    setPollingStationState({
                                        ...pollingStationState,
                                        showVotingSlipUpload: false,
                                        showQuestions: true,
                                        showVotingSlipSelection: true,
                                    })
                                }
                                text={t("pollingstation.button.cancel")}
                                type="primary"
                            />
                        </div>

                    </>
                )}
                {pollingStationState.showElection && pollingStationState.allowedToVote && (
                    <>
                        <div>
                            <Button
                                onClickAction={saveVotes}
                                isDisabled={pollingStationState.pending}
                                text={t("pollingstation.button.savevotes")}
                                type="primary"
                            />
                        </div>
                        {pollingStationState.showSendError && (
                            <Notification type="error" text={pollingStationState.showSendError} />
                        )}
                    </>
                )}
                {pollingStationState.taskId && (
                    <>
                        <VoteTransactionState taskId={pollingStationState.taskId} />
                    </>
                )}
            </div>
        </>
    );
}
