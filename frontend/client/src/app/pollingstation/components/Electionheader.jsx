'use client';
import { useState, useEffect } from "react";
import { useTranslation } from 'next-i18next';
import CountDown from "./CountDown";
import styles from "../styles/ElectionHeader.module.css";
import globalConst from "@/constants";
import { CircleDot } from 'lucide-react';

export default function Electionheader(props) {
    const { election, electionInformation } = props;
    const { t } = useTranslation();
    const [electionState, setElectionState] = useState(globalConst.electionState.ONGOING);

    useEffect(() => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const state = Number(currentTime) < Number(election.startTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(election.endTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
        setElectionState(state);
    }, []);

    return (
        <>

            <div className={`${styles.greystripe}`}>
                <div className={`${styles.inner_stripe}`}>

                    <div className={`${styles.inner_stripe_box}`}>
                        <div>
                            <img
                                src={electionInformation.headerImage.large}
                                className={styles.election_image}
                                alt=""
                            />
                        </div>
                    </div>

                    <div className={`${styles.inner_stripe_box} `}>
                        <div><h4>{electionInformation.title}</h4></div>
                        <div className={styles.election_informations}>
                            <div className={`${styles.election_informations_box}`}>
                                <h3>{electionInformation.author}</h3>
                                <small>{t('pollingstation.electionHeader.officer')}</small>
                            </div>
                            <div className={`${styles.election_informations_box}`}>
                                <h3>{election.totalVotes}</h3>
                                <small>{t('pollingstation.electionHeader.votes')}</small>
                            </div>
                            <div className={`${styles.election_informations_box}`}>
                                <h3>
                                    <CircleDot
                                        strokeWidth={5}
                                        className={`${styles.stateCircle} ${styles[electionState]}`}
                                    />
                                    {t('pollingstation.electionHeader.statetitle.' + electionState)}
                                </h3>
                                <small>{t('pollingstation.electionHeader.state')}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.bluestripe}>
                <div className="op__contentbox_max">
                    <CountDown
                        countDownEndTime={electionState == globalConst.electionState.ONGOING ? election.endTime : election.startTime}
                        countDownHeadLine={t('pollingstation.electionheader.countdown.headline.' + electionState)}
                        countDownState={'ongoing'}//{electionState == globalConst.electionState.FINISHED ? globalConst.electionState.FINISHED : globalConst.electionState.ONGOING}
                        electionStartDate={election.startTime}
                        electionEndDate={election.endTime}
                    />

                </div>
            </div>


        </>
    );
}
