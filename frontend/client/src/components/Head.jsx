'use client';
import { useEffect, useState } from "react";
import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";
import { CircleCheckBig, CircleMinus, CircleHelp, Trash2 } from 'lucide-react';
import Loading from "./Loading";
import { useTranslation } from 'next-i18next';
import globalConst from "@/constants";
import Button from "@/components/Button";
import LanguageSwitch from "./LanguageSwitch";

export default function Head() {
    const { t } = useTranslation();
    const { updatePage, updateUserKey, updateVoting, updateTaskId } = useOpnVoteStore((state) => state);

    const deleteUserKey = () => updateUserKey('');
    const deleteBallot = () => {
        updateVoting({ registerCode: '' });
        updateTaskId('');
        updatePage({ current: globalConst.pages.CREATEKEY });
    };


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
    };

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
                    <span className={`hover op__margin_standard_left`} onClick={deleteUserKey}>
                        <Trash2 size={18} />
                    </span>
                </>
            );
        } else {
            return (
                <>
                    <CircleMinus size={18} className={`op__display_inline_small op__display_none_wide op__margin_standard_left`} />
                    <strong className={`op__display_none_small op__display_inline_wide op__margin_standard_left`}>{t('common.nothingset')}</strong>
                </>
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
                    <span className={`hover op__margin_standard_left`} onClick={deleteBallot}>
                        <Trash2 size={18} />
                    </span>
                </>
            );
        } else {
            return (
                <>
                    <CircleMinus size={19} className={`op__display_inline_small op__display_none_wide op__margin_standard_left`} />
                    <strong className={`op__display_none_small op__display_inline_wide op__margin_standard_left`}>{t('common.nothingset')}</strong>
                </>
            );
        }
    };


    const goToHelpPage = () => {
        updatePage({ current: globalConst.pages.FAQ });
    };

    return (
        <>
            <div className={styles.header}>
                <div className={styles.headerbar}>
                    <HydrationZustand>
                        <div className={styles.headerbar_content}>
                            <span className={styles.headerbar_info}>
                                <span className={styles.headerbar_point}><span>{t('common.electionsecret')}</span><Showkey /></span>
                                <span className={styles.headerbar_point}><span>{t('common.ballotpaper')}</span><ShowBallot /></span>
                            </span>
                            <span className={styles.headerbar_menu}>
                                <LanguageSwitch />
                                <span className={styles.help_icon}>
                                    <Button
                                        onClickAction={() => goToHelpPage()}
                                        text={<CircleHelp size={22} />}
                                    />
                                </span>
                            </span>
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
