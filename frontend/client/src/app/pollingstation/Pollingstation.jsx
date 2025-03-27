'use client';

import { useState, useEffect } from "react";
import Notification from "../../components/Notification";
import Button from '../../components/Button';
import NavigationBox from '../../components/NavigationBox';
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import VoteTransactionState from "./components/VoteTransactionState";
import Electionheader from "./components/Electionheader";
import Question from "./components/Question";
import { getVoteCastsData } from '../../service-graphql';
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { sendVotes } from "./sendVotes";
import { useTranslation } from 'next-i18next';
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";

export default function Pollingstation() {
    const { updatePage, voting, updateVoting } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [votingCredentials, setVotingCredentials] = useState({});
    const [votes, setVotes] = useState({});
    const [getVoteCasts, { data: dataVotings, loading: loadingVotings }] = getVoteCastsData(votingCredentials?.voterWallet?.address, voting.election.id);

    // manages what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [pollingStationState, setPollingStationState] = useState({
        taskId: '',
        showElectionInformation: true,
        showElection: false,
        showVotingSlipUpload: false,
        showVotingSlipSelection: true,
        showNotification: false,
        showQuestions: true,
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
            const taskId = await sendVotes(votes, votingCredentials, voting.election.publicKey, pollingStationState.isVoteRecast);
            if (taskId) {
                updateVoting({ registerCode: '' });
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
                if (parseInt(credentials?.electionID) !== parseInt(voting?.election?.id)) {
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

    useEffect(() => {
        if (loadingVotings || !dataVotings) return;

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
            showQuestions: true,
            showNotification: true,
            notificationType: 'success',
            notificationText: t("pollingstation.notification.success.ballotfits")
        });
    }, [dataVotings]);

    useEffect(() => {
        // only if we have the electioninformations its worth to check
        // wether there is some voter informations stored.

        if (voting.registerCode?.length == 0 || Object.keys(voting.electionInformation).length === 0 || voting.electionInformation.constructor !== Object) {
            return;
        }
        qrCodeToCredentials(voting.registerCode);

    }, []);

    useEffect(() => {
        // here we have to see wether voter already voted to prepare for vote-recast
        if (Object.keys(votingCredentials).length > 0 && voting.election.id && Object.keys(voting.electionInformation).length > 0) {
            getVoteCasts();
        }

    }, [votingCredentials]);

    return (
        <>
            {pollingStationState.showElectionInformation && (
                <Electionheader
                    election={voting?.election}
                    electionInformation={voting.electionInformation}
                />
            )}

            {pollingStationState.showNotification && (
                <>
                    <Notification
                        type={pollingStationState.notificationType}
                        text={pollingStationState.notificationText}
                    />
                </>
            )}

            <div className={`${pollingStationState.allowedToVote ? 'op__contentbox_max' : 'op__contentbox_760'}`}>
                {pollingStationState.showQuestions && (
                    <>
                        {voting.electionInformation.questions.map((question, index) =>
                            <Question
                                key={index}
                                imageUrl={question.imageUrl}
                                questionKey={index}
                                question={question.text}
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
                                buttonText={t("pollingstation.navigationbox.registerforelection.buttonText")}
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
                                buttonText={t("pollingstation.navigationbox.continuetovote.buttonText")}
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
                                id="test_btn_sendvote"
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
