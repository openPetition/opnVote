'use client';

import { useEffect, useState } from "react";
import styles from '../styles/Footer.module.css';
import FooterDonationBox from './FooterHeartBox';
import NextImage from 'next/image';
import { useTranslation } from "next-i18next";
import Loading from "./Loading";
import Config from "../../next.config.mjs";

export default function Footer() {
    const { t } = useTranslation();
    const HydrationZustand = ({ children }) => {
        const [isPageHydrated, setIsPageHydrated] = useState(false);

        useEffect(() => {
            setIsPageHydrated(true);
        }, []);

        return (
            <>
                {isPageHydrated && (
                    <div>{children}</div>
                ) || (
                        <>
                            <div className={styles.greyblock}>
                                <div className={styles.greyblockcontent}></div>
                            </div>
                        </>
                    )
                }
            </>
        );
    };
    return (
        <>
            <footer>
                <HydrationZustand>
                    <FooterDonationBox />
                    <div className={styles.greyblock}>
                        <div className={styles.greyblockcontent}>
                            <div className={styles.checkmarks}>
                                <span className={styles.checkmark}>{t('footer.checkmarks.secret')}</span>
                                <span className={styles.checkmark}>{t('footer.checkmarks.verifiable')}</span>
                                <span className={styles.checkmark}>{t('footer.checkmarks.decentralized')}</span>
                            </div>
                            <div className={styles.logo}>
                                {t('footer.logo.text')}
                                <NextImage
                                    alt="openpetition logo"
                                    src="/images/openpetition-logo.png"
                                    height={68}
                                    width={194}
                                    style={{ marginTop: ".5rem" }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={styles.textblock}>
                        <div className={styles.textblockcontent}>
                            <div className={styles.copyright}>
                                <a href="https://creativecommons.org" rel="external nofollow">
                                    <NextImage
                                        src="/images/creative-commons.svg"
                                        height={20}
                                        width={20}
                                        alt="creative commons"
                                    />
                                </a>
                                {new Date().getFullYear()}
                                <a href="https://openpetition.net/" className={styles.link}>openPetition gGmbH</a>
                            </div>
                            <div className={styles.links}>
                                <a href="https://www.openpetition.de/content/data_privacy" className={styles.link}>{t('footer.links.dataprivacy')}</a>
                                <a href="https://www.openpetition.de/content/legal_details" className={styles.link}>{t('footer.links.impressum')}</a>
                                <a href="https://www.openpetition.de/content/about_us" className={styles.link}>{t('footer.links.aboutus')}</a>
                                <span className={styles.link}>{t('footer.version')} {Config.env.version}</span>
                            </div>
                        </div>
                    </div>
                </HydrationZustand>
            </footer>
        </>
    );
}
