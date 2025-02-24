'use client';
import { useEffect, useState } from "react";

import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";
import { Trash2, CircleCheckBig, CircleMinus } from 'lucide-react';
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
        const { user, updateUserKey } = useOpnVoteStore((state) => state);
        const deleteUserKey = () => updateUserKey('');
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
                    <span className={`hover op__margin_standard_left`} onClick={deleteUserKey}>
                        <Trash2 size={18} />
                    </span>

                </>
            );
        } else {
            return (
                <span className="op__padding_standard_left_right ">
                    <CircleMinus size={18} className={`op__display_inline_small`} />
                    <strong className={`op__display_none_small`}>{t('common.nothingset')}</strong>
                </span>
            );
        }
    }

    const ShowBallot = () => {
        return (
            <span className={`op__display_none_small op__padding_standard_left_right`}>
                <strong>{t('common.nothingset')}</strong>
            </span>
        );
    }

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
                <Image
                    alt="open.vote logo"
                    src="/images/opnvote-logo.png"
                    height={68}
                    width={194}
                    style={{ margin: "1rem auto" }}
                />
            </div>
        </>
    );
}
