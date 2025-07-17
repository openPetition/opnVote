'use client';
import { useState, useEffect } from "react";
import { useTranslation } from 'next-i18next';
import globalConst from "@/constants";
import CountDown from "@/components/CountDown";
import electiontime_styles from "@/styles/ElectionTime.module.css";

export default function ElectionTimeInfo(props) {
    const { countDownHeadLine, countDownEndTime, countDownState, electionStartDate, electionEndDate } = props;
    const { t } = useTranslation();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (countDownState !== globalConst.electionState.ONGOING) {
            const tempStartDate = new Date(Number(electionStartDate) * 1000);
            setStartDate(tempStartDate.toLocaleDateString());
            const tempEndDate = new Date(Number(electionEndDate) * 1000);
            setEndDate(tempEndDate.toLocaleDateString());
        }
    }, []);

    return (
        <>
            {countDownState === globalConst.electionState.ONGOING && (
                <>
                    <div className={electiontime_styles.timer_mainbox}>
                        <div className={electiontime_styles.timer_headline}>{countDownHeadLine}</div>
                        <CountDown countDownEndTime={countDownEndTime} />
                    </div>
                </>
            )}
            {countDownState === globalConst.electionState.PLANNED && (
                <>
                    <div className={electiontime_styles.timer_mainbox}>
                        <div className={electiontime_styles.timer_headline}>{countDownHeadLine}</div>
                        <CountDown countDownEndTime={countDownEndTime} />
                    </div>
                </>
            )}
            {countDownState === globalConst.electionState.FINISHED && (
                <>
                    <div className={electiontime_styles.timer_mainbox}>
                        <div className={electiontime_styles.timer_headline}>{countDownHeadLine}</div>
                        <div className={electiontime_styles.timer_headline}>
                            {startDate} {t('pollingstation.electionHeader.countdown.dateuntil')} {endDate}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
