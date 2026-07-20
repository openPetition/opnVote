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
    const [showInvalidVotesPopup, setShowInvalidVotesPopup] = useState(false);
    const election = voting.election;
    const [votes, setVotes] = useState(() =>
        voting.electionInformation.questions.map(() => VoteOption.Invalid)
    );
    const [ballotStationState, setBallotStationState] = useState({
        showSendError: false,
        pending: false,
    });

    const processVotes = () => {
        const hasInvalidVote = votes.some(vote => vote === VoteOption.Invalid);

        if (hasInvalidVote) {
            setShowInvalidVotesPopup(true);
        } else {
            saveVotes();
        }
    };

    const handleConfirmInvalidVotes = () => {
        setShowInvalidVotesPopup(false);
        saveVotes();
    };

    const saveVotes = async () => {
        let credentials = null;
        let response = "";
        let userOpHash = '';
        setBallotStationState({ ...ballotStationState, pending: true });

        try {
            if (voteClient && typeof voteClient.vote === 'function') {
                credentials = voteClient.importCredentials(voting.registerCode);
                const votesDTO = {
                    credentials: voteClient.importCredentials(voting.registerCode),
                    votes: votes.map(vote => ({ value: vote })),
                };
                if (!isVoteRecast) {
                    response = await voteClient.vote(votesDTO);
                    if (response.ok) {
                        userOpHash = response.value.txHash;
                    }
                } else {
                    response = await voteClient.recastVote(votesDTO);
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
                            selectedVote={votes[index] ?? VoteOption.Invalid}
                            showVoteOptions={allowedToVote}
                            setVote={(selection) => {
                                setVotes((prevVotes) =>
                                    prevVotes.map((currentVote, voteIndex) =>
                                        voteIndex === index ? selection : currentVote
                                    )
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
                    ctaButtonFunction={handleConfirmInvalidVotes}
                    onClose={() => setShowInvalidVotesPopup(false)}
                >
                    <div>
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'
                        }}>
                            <Notification
                                type="attention"
                                headline={t("ballotpaper.popup.missingselection.title")}
                                text={t("ballotpaper.popup.missingselection.message")}
                            />
                        </div>
                        <Button
                            type="primary"
                            stretched={true}
                            onClick={() => setShowInvalidVotesPopup(false)}
                            style={{
                                marginBottom: '20px'
                            }}
                        >
                            {t("ballotpaper.popup.missingselection.cancel")}
                        </Button>
                        <Button
                            type="secondary"
                            stretched={true}
                            onClick={() => handleConfirmInvalidVotes()}
                        >
                            {t("ballotpaper.popup.missingselection.continue")}
                        </Button>
                    </div>
                </Modal >
            </div >
        </>

    );
}
