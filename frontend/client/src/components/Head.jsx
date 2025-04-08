'use client';
import { useEffect, useState } from "react";

import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";
import { CircleCheckBig, CircleMinus } from 'lucide-react';
import Loading from "./Loading";
import { useTranslation } from 'next-i18next';

export default function Head() {
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
                            <Loading
                                loadingText={''}
                                theme={'small'}
                            />
                        </>
                    )
                }
            </>
        );
    }

    const Showkey = () => {
        const { user } = useOpnVoteStore((state) => state);
        if (user?.key) {
            return (
                <>
                    <strong className={`op__display_none_small op__display_inline_wide op__margin_standard_left`}>
                        {user.key.substring(0, 7)}..
                    </strong>
                    <CircleCheckBig
                        size={18}
                        strokeWidth={3}
                        color="#2e8444"
                        className={`op__display_inline_small op__display_none_wide op__margin_standard_left`}
                    />
                </>
            );
        } else {
            return (
                <span className="op__padding_standard_left_right ">
                    <CircleMinus size={18} className={`op__display_inline_small op__display_none_wide`} />
                    <strong className={`op__display_none_small op__display_inline_wide`}>{t('common.nothingset')}</strong>
                </span>
            );
        }
    };

    const ShowBallot = () => {
        const { voting } = useOpnVoteStore((state) => state);

        if (voting?.registerCode?.length > 0) {
            return (
                <>
                    <strong className={`op__display_none_small op__display_inline_wide op__margin_standard_left`}>
                        {voting.registerCode.substring(0, 7)}..
                    </strong>
                    <CircleCheckBig
                        size={18}
                        strokeWidth={3}
                        color="#2e8444"
                        className={`op__display_inline_small op__display_none_wide op__margin_standard_left`}
                    />
                </>
            );
        } else {
            return (
                <span className="op__padding_standard_left_right ">
                    <CircleMinus size={18} className={`op__display_inline_small op__display_none_wide`} />
                    <strong className={`op__display_none_small op__display_inline_wide`}>{t('common.nothingset')}</strong>
                </span>
            );
        }
    };

    return (
        <>
            <div className={styles.header}>
                <div className={styles.headerbar}>
                    <HydrationZustand>
                        <div className={styles.headerbar_content}>
                            <span className={styles.headerbar_point}><span>{t('common.electionsecret')}</span><Showkey /></span>
                            <span className={styles.headerbar_point}><span>{t('common.ballotpaper')}</span><ShowBallot /></span>
                        </div>
                    </HydrationZustand>
                </div>
                <div className={styles.logobar_content}>
                    <Image
                        alt="open.vote logo"
                        src="/images/opnvote-logo.svg"
                        height={69}
                        width={194}
                        className={styles.logo}
                    />
                </div>
            </div>
        </>
    );
}
