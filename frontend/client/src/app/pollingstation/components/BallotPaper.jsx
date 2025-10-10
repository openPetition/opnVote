'use client';
import styles from '../styles/BallotPaper.module.css';
import { useState, useEffect } from "react";
import Question from "./Question.jsx";
import { sendVotes } from "@/app/pollingstation/sendVotes";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "@/opnVoteStore";
import globalConst from "@/constants";
import Button from "@/components/Button";
import Notification from "@/components/Notification";

export default function BallotPaper(props) {
    const { allowedToVote, votingCredentials, isVoteRecast, showElection } = props;
    const { updatePage, voting, updateVoting, updateTaskId, taskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [votes, setVotes] = useState({});
    const [electionState, setElectionState] = useState(globalConst.electionState.ONGOING);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const election = voting.election;

    // manages what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [ballotStationState, setBallotStationState] = useState({
        taskId: '',
        showSendError: false,
        pending: false,
    });

    const saveVotes = async () => {
        setBallotStationState({ ...ballotStationState, pending: true });
        //result will be changed still ! we have to work with result (error notes.. redirect or sth else..)
        try {
            const taskId = await sendVotes(votes, votingCredentials, voting.election.publicKey, isVoteRecast);
            if (taskId) {
                updateTaskId(taskId);
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
        if (taskId && taskId.length > 0) {
            updateVoting({ votesuccess: false, transactionViewUrl: '' }); //invalidate
            updatePage({ current: globalConst.pages.VOTETRANSACTION });
        };
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
                            selectedVote={votes[index]}
                            showVoteOptions={allowedToVote}
                            setVote={(selection) => setVotes(votes => ({
                                ...votes,
                                [index]: selection
                            }))}
                        />

                    )}
                </div>

            </div>
            <div className="op__contentbox_960 op__center-align">

                {electionState === globalConst.electionState.ONGOING ? showElection && allowedToVote && (
                    <>
                        <div className="op__center-align">
                            <Button
                                onClick={saveVotes}
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
            </div>
        </>

    );
}
