import { useState } from "react";
import styles from '../styles/ProgressBar.module.css';
import globalConst from "@/constants";
import PhaseIcon from "./PhaseIcon";


export default function ProgressBar({activeStep}) {
    const arrow = (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="10" viewBox="0 0 22 10">
            <path id="Pfeil" d="M25,3.3l-9.5,9.4a2.052,2.052,0,0,1-2.9,0L3,3.3" transform="translate(-3 -3.3)" fill="#efefef"/>
        </svg>
    );
    const line = (
        <div className={styles.line}><div style={{borderBottom: "2px solid white"}}></div></div>
    );
    const nothing = (<div></div>);

    return (
        <div className={styles.progressBar}>
            <div className={styles.autoSpace} />
            <div className={`${styles.icon}`}>
                {activeStep == globalConst.progressBarStep.id ? arrow : nothing}
                <PhaseIcon type="id" variant={activeStep == globalConst.progressBarStep.id ? "blue" : "blueInversed"} />
            </div>
            {line}
            <div className={`${styles.icon}`}>
                {activeStep == globalConst.progressBarStep.key ? arrow : nothing}
                <PhaseIcon type="key" variant={activeStep == globalConst.progressBarStep.key ? "blue" : "blueInversed"} />
            </div>
            {line}
            <div className={`${styles.icon}`}>
                {activeStep == globalConst.progressBarStep.ballot ? arrow : nothing}
                <PhaseIcon type="ballot" variant={activeStep == globalConst.progressBarStep.ballot ? "blue" : "blueInversed"} />
            </div>
            {line}
            <div className={styles.icon}>
                {activeStep == globalConst.progressBarStep.vote ? arrow : nothing}
                <PhaseIcon type="vote" variant={activeStep == globalConst.progressBarStep.vote ? "blue" : "blueInversed"} />
            </div>
            <div className={styles.autoSpace} />
        </div>
    );
};
