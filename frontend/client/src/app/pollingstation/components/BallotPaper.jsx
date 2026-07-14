'use client';
import styles from '../styles/BallotPaper.module.css';
import { useState, useEffect } from "react";
import Question from "./Question.jsx";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "@/opnVoteStore";
import globalConst from "@/constants";
import Button from "@/components/Button";
import { useVoting } from "@/app/VotingContext"
import Notification from "@/components/Notification";
import { VoteOption } from "votingsystem";
import Modal from "@/components/Modal";

export default function BallotPaper(props) {
    const { allowedToVote, votingCredentials, isVoteRecast, showElection } = props;
    const { updatePage, voting, updateVoting, voteClient, hashes, updateHashes } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [electionState, setElectionState] = useState(globalConst.electionState.ONGOING);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [showInvalidVotesPopup, setShowInvalidVotesPopup] = useState("");
    const election = voting.election;
    const [votes, setVotes] = useState(() =>
        voting.electionInformation.questions.map(() => VoteOption.Invalid)
    );
    const [ballotStationState, setBallotStationState] = useState({
        showSendError: false,
        pending: false,
    });

    const processVotes = () => {
        const readyVoteMap = votes.map(v => ({ value: v }));
        const hasInvalidVote = votes.some(v => v === VoteOption.Invalid);

        if (hasInvalidVote) {
            setShowInvalidVotesPopup(true);
        } else {
            saveVotes(readyVoteMap);
        }
    };

    const handleConfirmInvalidVotes = () => {
        setShowInvalidVotesPopup(false);
        const readyVoteMap = votes.map(v => ({ value: v }));
        saveVotes(readyVoteMap);
    };


    const saveVotes = async (readyVoteMap) => {
        let credentials = null;
        let response = "";
        let userOpHash = '';
        setBallotStationState({ ...ballotStationState, pending: true });
        //result will be changed still ! we have to work with result (error notes.. redirect or sth else..)
        try {
            if (voteClient && typeof voteClient.vote === 'function') {
                credentials = voteClient.importCredentials(voting.registerCode);
                if (!isVoteRecast) {
                    response = await voteClient.vote({ credentials: credentials, votes: voteMap });
                    if (response.ok) {
                        userOpHash = response.value.txHash;
                    }
                } else {
                    response = await voteClient.recastVote({ credentials: credentials, votes: voteMap });
                    if (response.ok) {
                        userOpHash = response.value.txHash;
                    }
                }
            }

            if (userOpHash && userOpHash.length > 0) {
                updateHashes(response.value);
                updateVoting({ votesuccess: false, transactionViewUrl: '' }); //invalidate
                updatePage({ current: globalConst.pages.VOTETRANSACTION });
            }
        } catch (e) {
            setBallotStationState({
                ...ballotStationState,
                showSendError: t('pollingstation.button.errormessage'),
                pending: true,
            });
            setTimeout(() => {
                setBallotStationState({ ...ballotStationState, pending: false });
            }, 10000);
        }
    };

    useEffect(() => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const state = Number(currentTime) < Number(election.votingStartTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(election.votingEndTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
        setElectionState(state);
        const tempStartTime = new Date(Number(voting.election.votingStartTime) * 1000);
        const tempEndTime = new Date(Number(voting.election.votingEndTime) * 1000);
        setStartDate(tempStartTime);
        setEndDate(tempEndTime);
        console.log(votes);
    }, []);

    return (
        <>
            <div className={`${styles.ballot_paper_frame} op__contentbox_960`}>
                <div className={'op__padding_standard_20'}>
                    <div className={`${styles.display_flex} ${styles.justify_content} op__padding_standard_bottom`}>
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
                            // votes[index] ist jetzt direkt die Zahl (0, 1, 2 oder 3)
                            selectedVote={votes[index] ?? VoteOption.Invalid}
                            showVoteOptions={allowedToVote}
                            setVote={(selection) => {
                                // Keine komplexen Objekt-Prüfungen mehr nötig!
                                setVotes(prevVotes =>
                                    prevVotes.map((v, i) => i === index ? selection : v)
                                );
                            }}
                        />

                    )}
                </div>

            </div>
            <div className="op__contentbox_960 op__center-align">

                {electionState === globalConst.electionState.ONGOING ? showElection && allowedToVote && (
                    <>
                        <div className="op__center-align">
                            <Button
                                onClick={processVotes}
                                disabled={ballotStationState.pending}
                                type="primary"
                                id="test_btn_sendvote"
                            >{t("pollingstation.button.savevotes")}</Button>
                        </div>
                        {ballotStationState.showSendError && (
                            <Notification type="error" text={ballotStationState.showSendError} />
                        )}
                    </>
                )
                    :
                    <div className="op__center-align">
                        <Button
                            onClick={() => updatePage({ current: globalConst.pages.OVERVIEW })}
                            disabled={ballotStationState.pending}
                            type="primary"
                        >{t("common.gotooverview")}</Button>
                    </div>
                }
                <Modal
                    showModal={showInvalidVotesPopup}
                    headerText={t("pollingstation.popup.title", "Unvollständiger Stimmzettel")}
                    ctaButtonText={t("common.confirm", "Stimme trotzdem abgeben")}
                    ctaButtonFunction={handleConfirmInvalidVotes}
                >
                    <div>
                        <p style={{ marginBottom: '20px' }}>
                            {t("pollingstation.popup.message", "Sie haben nicht für alle Fragen eine Auswahl getroffen. Diese Fragen werden als UNGÜLTIG gezählt. Möchten Sie Ihre Stimme trotzdem so abgeben?")}
                        </p>
                        {/* Zusätzlicher Abbrechen-Button direkt im Body, da das Modal-Design standardmäßig keinen zweiten Button im Footer vorsieht */}
                        <Button
                            type="secondary"
                            stretched={true}
                            onClick={() => setShowInvalidVotesPopup(false)}
                        >
                            {t("common.cancel", "Zurück zum Stimmzettel")}
                        </Button>
                    </div>
                </Modal>
            </div>
        </>

    );
}
