import styles from '../styles/ProgressBar.module.css';
import globalConst from "@/constants";
import PhaseIcon from "./PhaseIcon";
import { useTranslation, Trans } from "next-i18next";
import { Fragment } from 'react';

export default function ProgressBar({activeStep}) {
    const { t } = useTranslation();

    const arrow = (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="10" viewBox="0 0 22 10">
            <path id="Pfeil" d="M25,3.3l-9.5,9.4a2.052,2.052,0,0,1-2.9,0L3,3.3" transform="translate(-3 -3.3)" fill="#efefef"/>
        </svg>
    );

    const phases = [
        {
            key: "key",
            steps: [
                globalConst.progressBarStep.createKey,
                globalConst.progressBarStep.saveKey,
                globalConst.progressBarStep.savedKey
            ],
            start: 0,
        },
        {
            key: "ballot",
            steps: [
                globalConst.progressBarStep.createBallot,
                globalConst.progressBarStep.saveBallot
            ],
            start: 50,
        },
        {
            key: "readyToVote",
            steps: [
                globalConst.progressBarStep.readyToVote
            ],
            start: 100,
        },
    ];

    const visiblePhases = phases.filter(p => p.key !== "readyToVote");

    const progress = globalConst.progressMapping[activeStep] ?? 0;

    const nothing = (<div></div>);

    const currentPhaseKey = phases.find((phase) => phase.steps.includes(activeStep))?.key;

    const showArrow = (phaseKey) => {
        if (phaseKey == "key") {
            return currentPhaseKey == "key";
        }

        if (phaseKey == "ballot") {
            return currentPhaseKey == "ballot" || currentPhaseKey == "readyToVote";
        }

        return false;
    };
    const isPhaseBlue = (phaseKey) => {
        if (phaseKey == "key") return true;

        if (phaseKey == "ballot") {
            return currentPhaseKey == "readyToVote";
        }

        return false;
    };

    return (
        <div className={styles.progressBar}>
            <div className={styles.autoSpace} />

            {visiblePhases.map((phase, index) => {
                const isActive = showArrow(phase.key);
                const isBlue = isPhaseBlue(phase.key);

                return (
                    <Fragment key={phase.key}>
                        <div className={styles.icon}>
                            {isActive ? arrow : nothing}
                            <PhaseIcon
                                type={phase.key}
                                variant={isBlue ? 'blue' : 'blueInversed'}
                            />
                        </div>

                        {index < visiblePhases.length - 1 && (
                            <div className={styles.wrapperFlex}>
                                <span className={styles.percentage}>
                                    {t('progressbar.text', { PROGRESS: progress})}
                                </span>

                                <div className={styles.line}>
                                    <div className={styles.lineBackground} />
                                    <div className={styles.lineProgress}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </Fragment>
                );
            })}
            <div className={styles.autoSpace} />
        </div>
    );
};
