'use client';
import styles from '../styles/BallotPaper.module.css';
import { useState, useEffect } from "react";
import Question from "../app/pollingstation/components/Question.jsx";
import { getVoteCastsData } from "@/service-graphql";
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { sendVotes } from "@/app/pollingstation/sendVotes";
import { useTranslation } from 'next-i18next';
import Config from "../../next.config.mjs";
import { useOpnVoteStore } from "@/opnVoteStore";
import globalConst from "@/constants";
import Button from "@/components/Button";
import Notification from "@/components/Notification";

export default function BallotPaper(props) {
    const { updatePage, voting, updateVoting, updateTaskId, taskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [votingCredentials, setVotingCredentials] = useState({});
    const [votes, setVotes] = useState({});
    const [getVoteCasts, { data: dataVotings, loading: loadingVotings }] = getVoteCastsData(votingCredentials?.voterWallet?.address, voting.election.id);
    const [electionState, setElectionState] = useState(globalConst.electionState.ONGOING);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const election = voting.election;

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

    const saveVotes = async () => {
        setPollingStationState({ ...pollingStationState, pending: true });
        //result will be changed still ! we have to work with result (error notes.. redirect or sth else..)
        try {
            const taskId = await sendVotes(votes, votingCredentials, voting.election.publicKey, pollingStationState.isVoteRecast);
            if (taskId) {
                updateTaskId(taskId);
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
                        notificationType: 'error',
                        popupButtonText: t("pollingstation.notification.error.ballotnotfitting.popup.buttontext"),
                        popupHeadline: t("pollingstation.notification.error.ballotnotfitting.popup.headline"),
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
                notificationType: 'error',
                popupButtonText: t("pollingstation.notification.error.ballotdatacorrupt.popup.buttontext"),
                popupHeadline: t("pollingstation.notification.error.ballotdatacorrupt.popup.headline"),
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
                notificationText: t("pollingstation.notification.error.novotechange"),
                notificationType: 'error',
                showVotingSlipUpload: false,
                showVotingSlipSelection: false,
                popupButtonText: t("pollingstation.notification.error.novotechange.popup.buttontext"),
                popupHeadline: t("pollingstation.notification.error.novotechange.popup.headline"),
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
            notificationText: t("pollingstation.notification.success.ballotfits"),
            popupButtonText: t("pollingstation.notification.success.popup.buttontext"),
            popupHeadline: t("pollingstation.notification.success.popup.headline"),
        });
    }, [dataVotings]);

    useEffect(() => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const state = Number(currentTime) < Number(election.votingStartTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(election.votingEndTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
        setElectionState(state);
        const tempStartTime = new Date(Number(voting.election.votingStartTime) * 1000);
        const tempEndTime = new Date(Number(voting.election.votingEndTime) * 1000);
        setStartDate(tempStartTime);
        setEndDate(tempEndTime);
        if (taskId && taskId.length > 0) {
            updateVoting({ votesuccess: false, transactionViewUrl: '' }); //invalidate
            updatePage({ current: globalConst.pages.VOTETRANSACTION });
        };

        // only if we have the electioninformations its worth to check
        // wether there is some voter informations stored.
        if (voting.registerCode?.length === 0 || Object.keys(voting.electionInformation).length === 0 || voting.electionInformation.constructor !== Object) {
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


            <>
                <div className={`${styles.ballot_paper_frame} op__contentbox_960`}>
                    <div className={'op__padding_standard_20'}>
                        <div className={`${styles.display_flex} ${styles.justify_content}`}>
                            <h2 className={styles.h2}>{t("pollingstation.ballotPaper.headline")}</h2>
                            {/*<a className={'op__arrow-right'}>{t('pollingstation.ballotPaper.linkToBallotBooklet')}</a>*/}
                        </div>
                        <div>
                            <p>{t('pollingstation.ballotPaper.ballotSubheading')}:</p>
                            <p><b>"{voting.electionInformation.title}"</b> {t('pollingstation.ballotPaper.ballotPeriod', { STARTDATE: startDate, ENDDATE: endDate, interpolation: { escapeValue: false } })}.</p>
                        </div>
                    </div>
                    <div className={styles.ballot_paper_border}></div>
                    <div className={'op__padding_standard_20'}>
                        <p>{t('pollingstation.ballotPaper.ballotInfo')}</p>
                    </div>
                    <div className={styles.ballot_paper_border}></div>
                    <div className={`op__padding_standard_20 op__wrapper__flex ${styles.op__wrapper__flex}`}>
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
                    </div>
                    <div className={styles.ballot_paper_border}></div>
                    <div className={'op__padding_standard_20'}>
                        <p>{t('pollingstation.ballotPaper.voteInvalid')}</p>
                    </div>
                </div>
                <div className="op__contentbox_960 op__center-align">

                    {electionState === globalConst.electionState.ONGOING ?
                        pollingStationState.showElection && pollingStationState.allowedToVote && (
                            <>
                                <div className="op__center-align">
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
                        )
                        :
                        <div className="op__center-align">
                            <Button
                                onClickAction={() => updatePage({ current: globalConst.pages.OVERVIEW })}
                                isDisabled={pollingStationState.pending}
                                text={t("common.gotooverview")}
                                type="primary"
                            />
                        </div>
                    }
                </div>
            </>
        </>
    );
}
