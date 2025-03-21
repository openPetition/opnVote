'use client';
import { useState, useEffect } from "react";
import CountDownDisplay from "./CountDownDisplay";
import styles from "../styles/ElectionHeader.module.css";
import globalConst from "@/constants";
import { useTranslation } from 'next-i18next';

export default function CountDown(props) {
    const { countDownHeadLine, countDownEndTime, countDownState, electionStartDate, electionEndDate } = props;
    const { t } = useTranslation();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [timeLeft, setTimeLeft] = useState({
        days: '0',
        hours: '0',
        minutes: '0',
        seconds: '0',
    });

    const electionCountdown = () => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const distance = countDownEndTime - currentTime;

        setTimeLeft({
            days: Math.floor(distance / (60 * 60 * 24)).toString(),
            hours: Math.floor((distance % (60 * 60 * 24)) / (60 * 60)).toString(),
            minutes: Math.floor((distance % (60 * 60)) / (60)).toString(),
            seconds: Math.floor((distance % (60))).toString()
        });
    };

    useEffect(() => {
        if (countDownState === globalConst.electionState.ONGOING) {
            //countdown refreshes every minute as it should not rerender every second cause this could cause timing problems
            const interval = setInterval(() => {
                electionCountdown();
            }, 1000);
            return () => clearInterval(interval);
        } else {
            const tempStartDate = new Date(Number(electionStartDate) * 1000);
            setStartDate(tempStartDate.toLocaleDateString());
            const tempEndDate = new Date(Number(electionEndDate) * 1000);
            setEndDate(tempEndDate.toLocaleDateString());
        }
    }, [timeLeft]);

    return (
        <>
            {countDownState === globalConst.electionState.ONGOING && (
                <>
                    {timeLeft && Object.keys(timeLeft).length > 0 && (
                        <div className={styles.timer_mainbox}>
                            <div className={styles.timer_headline}>{countDownHeadLine}</div>
                            <div className={styles.timer}>
                                <CountDownDisplay leftValue={timeLeft.days} leftUnit={t('pollingstation.electionHeader.countdown.days')} />
                                <div className={styles.timer_item_between}><h3>:</h3></div>
                                <CountDownDisplay leftValue={timeLeft.hours} leftUnit={t('pollingstation.electionHeader.countdown.hours')} />
                                <div className={styles.timer_item_between}><h3>:</h3></div>
                                <CountDownDisplay leftValue={timeLeft.minutes} leftUnit={t('pollingstation.electionHeader.countdown.minutes')} />
                                <div className={styles.timer_item_between}><h3>:</h3></div>
                                <CountDownDisplay leftValue={timeLeft.seconds} leftUnit={t('pollingstation.electionHeader.countdown.seconds')} />
                            </div>
                        </div>
                    )}
                </>
            )}
            {countDownState === globalConst.electionState.FINISHED && (
                <>
                    <div className={styles.timer_mainbox}>
                        <div className={styles.timer_headline}>{countDownHeadLine}</div>
                        <div className={styles.timer_headline}>
                            {startDate} {t('pollingstation.electionHeader.countdown.dateuntil')} {endDate}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
