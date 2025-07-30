'use client';
import { useState, useEffect } from "react";
import { useTranslation } from 'next-i18next';
import styles from "../styles/electioninfobox.module.css";
import globalConst from "@/constants";
import { CircleDot } from 'lucide-react';
import { useOpnVoteStore } from "../../../opnVoteStore";

export default function ElectionInfoBox(props) {
    const { showTitleOnlyMobile } = props;
    const { voting } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [electionState, setElectionState] = useState(globalConst.electionState.ONGOING);
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const state = Number(currentTime) < Number(voting.election.votingStartTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(voting.election.votingEndTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
        setElectionState(state);
        const tempEndDate = new Date(Number(voting.election.votingEndTime) * 1000);
        setEndDate(tempEndDate.toLocaleString("de-DE", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: '2-digit',
            minute: '2-digit'
        }));
    }, []);

    return (
        <>
            <div className={`${styles.stripe} op__outerbox_grey op__margin_standard_20_top_bottom ${showTitleOnlyMobile ? 'op__display_block_wide op__display_none_small' : ''}`}>

                <div className={`${styles.inner_stripe_box}`}>
                    <div>
                        <img
                            src={voting.electionInformation.headerImage.small}
                            className={styles.election_image}
                            alt=""
                        />
                    </div>
                    <div><h3 className={`${styles.title}`}>{voting.electionInformation.title}</h3></div>
                </div>

                <div className={`${styles.inner_stripe_box} `}>

                    <div className={styles.election_informations}>
                        <div className={`${styles.election_informations_box}`}>
                            <h3>
                                <CircleDot
                                    strokeWidth={5}
                                    className={`${styles.state_circle} ${styles[electionState]}`}
                                />
                                {t('register.smallHeader.statetitle.' + electionState)}
                            </h3>
                            <small>{t('register.smallHeader.state')}</small>
                        </div>
                        <div className={`${styles.election_informations_box}`}>
                            <h3>{endDate}</h3>
                            <small>{t('register.smallHeader.electionend')}</small>
                        </div>
                        <div className={`${styles.election_informations_box}`}>
                            <h3>{t('register.smallHeader.whatshappening.state.' + electionState)}</h3>
                            <small>{t('register.smallHeader.whatshappening.title')}</small>
                        </div>

                    </div>
                </div>

            </div>
            <div className={`${styles.stripe} op__outerbox_grey op__margin_standard_20_top_bottom ${showTitleOnlyMobile ? 'op__display_block_small op__display_none_wide' : 'op__display_none_small op__display_none_wide'}`}>
                <h3 className={`${styles.title}`}>{voting.electionInformation.title}</h3>
            </div>
        </>
    );
}
