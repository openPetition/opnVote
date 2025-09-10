'use client';
import { useEffect, useState, useRef } from "react";
import Image from 'next/image';
import styles from '../styles/Header.module.css';
import { useOpnVoteStore } from "../opnVoteStore";
import { Trash2, Menu, X, Check, KeyRound, ReceiptText } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import globalConst from "@/constants";
import LanguageSwitch from "@/components/LanguageSwitch";
import LanguageSwitchSelect from "@/components/LanguageSwitchSelect";

export default function Head() {
    const { t } = useTranslation();
    const { updatePage, updateUserKey, updateVoting, updateTaskId, page } = useOpnVoteStore((state) => state);


    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    // Click outside menu should close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Against event bubbling (instant close and open)
            if (event.target.closest(`.${styles.hamburger}`)) {
                return
            }
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                closeMenu();
            }
        };

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    const Showkey = ({ showStateIcons }) => {
        const { user } = useOpnVoteStore((state) => state);

        return (
            <>
                <div className={`${showStateIcons ? 'op__margin_standard_right' : ''} op__position_relative`}>
                    <KeyRound
                        size={20}
                        strokeWidth={2}
                        color="#000"
                    />
                    {showStateIcons && (
                        <>
                            {user?.key ? (
                                <Check
                                    className={styles.roundedActive}
                                    color="#fff"
                                    size={16}
                                    strokeWidth={3}
                                />
                            ) : (
                                <X
                                    className={styles.roundedInactive}
                                    color="#fff"
                                    size={16}
                                    strokeWidth={3}
                                />
                            )}
                        </>
                    )}
                </div>
                <span className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl op__margin_standard_left' : 'op__margin_standard_left'}`}>
                    {t('common.electionsecret')}: &nbsp;
                </span>

                {!user?.key ? (
                    <strong className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl' : ''}`}>{t('common.nothingset')}</strong>
                ) : (
                    <strong className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl ' : ''}`}>
                        {user.key.substring(0, 7)}..
                    </strong>
                )}
            </>
        );
    };


    const ShowBallot = ({ showStateIcons }) => {
        const { voting } = useOpnVoteStore((state) => state);

        return (
            <>
                <div className={`${showStateIcons ? 'op__margin_standard_right' : ''} op__position_relative`}>
                    <ReceiptText
                        size={20}
                        strokeWidth={2}
                        color="#000"
                        className={``}
                    />

                    {showStateIcons && (
                        <>
                            {voting?.registerCode?.length > 0 ? (
                                <Check
                                    className={styles.roundedActive}
                                    color="#fff"
                                    size={16}
                                    strokeWidth={3}
                                />
                            ) : (
                                <X
                                    className={styles.roundedInactive}
                                    color="#fff"
                                    size={16}
                                    strokeWidth={3}
                                />
                            )}
                        </>
                    )}

                </div>
                <span className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl op__margin_standard_left' : 'op__margin_standard_left'}`}>
                    {t('common.ballotpaper')}: &nbsp;
                </span>

                {voting.registerCode ? (
                    <strong className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl' : ''}`}>
                        {voting.registerCode.substring(0, 7)}..
                    </strong>
                ) : (
                    <strong className={`${showStateIcons ? 'op__display_none_small op__display_inline_wide_xl' : ''}`}>
                        {t('common.nothingset')}
                    </strong>
                )}
            </>
        );

    };

    const goToFaqPage = () => {
        if (page.current === 'faq') {
            closeMenu();
            return;
        }
        updatePage({ previous: page.current, current: globalConst.pages.FAQ });
    };

    const goToGlossaryPage = () => {
        if (page.current === 'glossary') {
            closeMenu();
            return;
        }
        updatePage({ previous: page.current, current: globalConst.pages.GLOSSARY });
    };

    return (
        <>
            <div className={`op__header ${styles.header}`}>

                <div className={styles.headerbar}>
                    <div>
                        <Image
                            alt="open.vote logo"
                            src="/images/opnvote-logo.svg"
                            width="0"
                            height="0"
                            sizes="100vw"
                            onClick={() => updatePage({ current: globalConst.pages.OVERVIEW, loading: false })}
                            className={styles.logo}
                        />
                    </div>
                    <div className={styles.navigationbar}>
                        <Showkey
                            showStateIcons={true}
                        />
                        <div className={`op__margin_standard_left_right ${styles.separator}`}></div>
                        <ShowBallot
                            showStateIcons={true}
                        />

                        <div className={`op__display_none_small op__display_block_wide_xl op__margin_standard_left_right ${styles.separator}`}></div>
                        <div className={`op__display_none_small op__display_block_wide_xl`}>
                            <LanguageSwitch />
                        </div>
                        <div className={`op__display_none_small op__display_block_wide_xl op__margin_standard_left_right ${styles.separator}`}></div>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="Toggle Menu"
                            tabIndex="0"
                        >
                            <Menu
                                size={26}
                                strokeWidth={3}
                                color="#000"
                                className={`op__display_inline_small ${styles.hamburger}`}
                            />
                        </button>
                        <div ref={menuRef} className={`${styles.menuBox} ${isMenuOpen ? styles.menuBoxOpen : styles.menuBoxClosed}`}>
                            <ul>
                                <li>
                                    <span className={`${styles.headerbar_point} op__flex_box`}> <Showkey />
                                    </span>
                                </li>
                                <li>
                                    <span className={`${styles.headerbar_point} op__flex_box`}>
                                        <ShowBallot />
                                    </span>
                                </li>
                            </ul>
                            <hr className={styles.borderLine} />
                            <ul className={styles.menulinks}>
                                <li><button
                                    className={styles.menulink}
                                    onClick={() => updatePage({ current: globalConst.pages.OVERVIEW, loading: false })}
                                >
                                    {t('navigation.point.electiondocs')}
                                </button></li>
                                <li><a href="https://www.opn.vote/" className={styles.menulink}>{t('navigation.point.blog')}</a></li>
                                <li><button className={styles.menulink} onClick={goToFaqPage}>{t('navigation.point.faq')}</button></li>
                                <li><button className={styles.menulink} onClick={goToGlossaryPage}>{t('navigation.point.glossary')}</button></li>

                            </ul>
                            <hr className={styles.borderLine} />
                            <div>
                                <LanguageSwitchSelect />
                            </div>
                        </div>
                    </div>
                </div>


            </div >
        </>
    );
}
