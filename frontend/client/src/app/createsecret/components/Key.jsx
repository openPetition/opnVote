'use client';
import { useEffect, useState } from "react";
import styles from './../styles/Key.module.css';
import { useTranslation } from 'next-i18next';

export default function LoadKey(props) {
    const [isRendered, setIsRendered] = useState(false);
    const { t } = useTranslation();
    const { showLoadingAnimation, animationDuration, onClickAction } = props;

    const startAnimation = () => {
        var elements = document.getElementsByClassName('animatefirst');
        for (var i = 0; i < elements.length; i++) {
            elements[i].beginElement();
        }
    };

    useEffect(() => {
        if (showLoadingAnimation) {
            startAnimation();
        }
    }, [showLoadingAnimation]);

    useEffect(() => {
        if (!isRendered) {
            setIsRendered(true);
        }
    }, []);

    return (
        <>

            <div className="op__padding_standard_top_bottom">
                {isRendered && (
                    <>
                        <h3 className="op__center-align op__padding_standard_bottom">{t('secret.key.headline')}</h3>
                        <p className="op__center-align op__padding_standard_bottom">{t('secret.headline.createSecret.infoText')}</p>
                        <button
                            className={styles.key_circle_button}
                            onClick={onClickAction}
                        >
                            <svg id={styles.key_svg} xmlns="http://www.w3.org/2000/svg" width="140" height="67.47" viewBox="0 0 140 67.47">
                                <defs>
                                    <linearGradient id="left-to-right-circle">
                                        <stop offset="0" stopColor="#29B0CC">
                                            <animate dur={animationDuration / 2} attributeName="offset" className="animatefirst" begin="indefinite" fill="freeze" from="0" to="1" />
                                        </stop>
                                        <stop offset="0" stopColor="#DEDEDE">
                                            <animate id="animatefirst" dur={animationDuration / 2} className="animatefirst" attributeName="offset" begin="indefinite" fill="freeze" from="0" to="1" />
                                        </stop>
                                    </linearGradient>
                                    <linearGradient id="left-to-right">
                                        <stop offset="0" stopColor="#0D6C7F">
                                            <animate dur={animationDuration / 2} attributeName="offset" fill="freeze" begin="animatefirst.end" from="0" to="1" />
                                        </stop>
                                        <stop offset="0" stopColor="#DEDEDE">
                                            <animate dur={animationDuration / 2} attributeName="offset" fill="freeze" begin="animatefirst.end" from="0" to="1" />
                                        </stop>
                                    </linearGradient>
                                </defs>

                                <g transform="translate(-310 -106.265)">
                                    <path
                                        id="Pfad_167"
                                        data-name="Pfad 167"
                                        d="M431.446,124.819H368.193l3.373,33.735h5.9l6.747-7.59,6.747,7.59,6.747-7.59,6.747,7.59,6.747-7.59,6.747,7.59,6.747-7.59,6.747,7.59L450,141.687Z"
                                        fill="url(#left-to-right)"
                                    />
                                    <circle id="Ellipse_147" data-name="Ellipse 147" cx="33.735" cy="33.735" r="33.735" transform="translate(310 106.265)" fill="url(#left-to-right-circle)" />
                                    <circle
                                        fill="#fff"
                                        id="Ellipse_148"
                                        data-name="Ellipse 148"
                                        cx="19.491"
                                        cy="19.491"
                                        r="19.491"
                                        transform="translate(324.244 120.509)"
                                    />
                                </g>
                            </svg>
                        </button>
                    </>
                )}
            </div>
        </>
    );
}
