'use client';

import { useState, useEffect } from "react";
import NextImage from "next/image";
import styles from '../styles/Headline.module.css';
import ProgressBar from './ProgressBar';

export default function Headline(props) {
    const { title, text, infoText, image, backgroundImage, progressBarStep } = props;

    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(window.innerWidth < 600);

        const handleResize = () => {
            setIsMobile(window.innerWidth < 600);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const textSeen = localStorage.getItem("textSeen");
        var lastTitle = localStorage.getItem("lastTitle");

        if (!textSeen || lastTitle != title) {
            setIsTextExpanded(true);
            localStorage.setItem("textSeen", true);
            localStorage.setItem("lastTitle", title);
        }
    }, [title]);

    const toggleInfoText = () => {
        setIsInfoExpanded(previousState => !previousState);
    };

    return (
        <div className="bg-op-blue">
            <div style={{ backgroundColor: "var(--op-grey-main)" }} className="op__padding_standard op__center-align">
                <div className={styles.title}>{title}</div>

                {text && /* @TODO: wird der text jemals angezeigt? */(<div className="op__padding_standard_top_bottom">
                    {text}
                </div>)}
            </div>
            {progressBarStep && (<ProgressBar activeStep={progressBarStep}/>)}
            {backgroundImage && (
                <div className={styles.successHeader} style={{ height: '200px', backgroundImage: `url('/images/${backgroundImage}.png')` }}></div>
            )}
            {infoText && (
                <div className={`${styles.infoContainer}`}>
                    <NextImage
                        src={image}
                        priority
                        height={40}
                        width={40}
                        alt=""
                    />


                    <div className={styles.infoText}>
                        {isInfoExpanded ? infoText : isMobile ? `${infoText.substring(0, 50)}...` : infoText}
                    </div>


                    {isMobile && (
                        <button className={`op__padding_standard_right ${styles.infoToggleButton}`} onClick={toggleInfoText}>
                            <NextImage
                                src={isInfoExpanded ? "/images/arrow-up.svg" : "/images/arrow-down.svg"}
                                priority
                                height={15}
                                width={15}
                                alt="toggle arrow"
                            />
                        </button>
                    )}

                </div>
            )}
        </div>
    );
}
