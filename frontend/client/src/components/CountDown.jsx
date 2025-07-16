'use client';
import { useState, useEffect } from "react";
import countdown_styles from "@/styles/CountDown.module.css";
import { useTranslation } from 'next-i18next';

export default function CountDown(props) {
    const { countDownEndTime } = props;
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState({
        distance: 1,
        days: '0',
        hours: '0',
        minutes: '0',
        seconds: '0',
    });

    const CountdownTime = () => {
        const currentTime = Math.floor(new Date().getTime() / 1000);
        const distance = countDownEndTime - currentTime;
        if (distance > 0) {
            setTimeLeft({
                distance: distance,
                days: Math.floor(distance / (60 * 60 * 24)).toString(),
                hours: Math.floor((distance % (60 * 60 * 24)) / (60 * 60)).toString(),
                minutes: Math.floor((distance % (60 * 60)) / (60)).toString(),
                seconds: Math.floor((distance % (60))).toString()
            });
        }
    };

    useEffect(() => {
        if (timeLeft.distance > 0) {
            //countdown refreshes every minute as it should not rerender every second cause this could cause timing problems
            const interval = setInterval(() => {
                CountdownTime();
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [timeLeft]);


    const CountDownDisplay = (props) => {
        const { leftValue, leftUnit } = props;
        return (
            <>
                <div className={countdown_styles.timer_item}>
                    <h3>{leftValue}</h3>
                    {leftUnit}
                </div>
            </>
        );
    }

    return (
        <>
            <div className={countdown_styles.timer}>
                <CountDownDisplay leftValue={timeLeft.days} leftUnit={t('pollingstation.electionHeader.countdown.days')} />
                <div className={countdown_styles.timer_item_between}><h3>:</h3></div>
                <CountDownDisplay leftValue={timeLeft.hours} leftUnit={t('pollingstation.electionHeader.countdown.hours')} />
                <div className={countdown_styles.timer_item_between}><h3>:</h3></div>
                <CountDownDisplay leftValue={timeLeft.minutes} leftUnit={t('pollingstation.electionHeader.countdown.minutes')} />
                <div className={countdown_styles.timer_item_between}><h3>:</h3></div>
                <CountDownDisplay leftValue={timeLeft.seconds} leftUnit={t('pollingstation.electionHeader.countdown.seconds')} />
            </div>
        </>

    );
}
