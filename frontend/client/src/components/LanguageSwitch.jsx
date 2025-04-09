"use client";

import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import styles from "./../styles/LanguageSwitch.module.css";
import Image from "next/image";
import globalConst from "@/constants";

export default function LanguageSwitch() {
    const { t } = useTranslation();
    const { i18n } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [currentLanguage, setCurrentLanguage] = useState(i18n.resolvedLanguage);

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setIsMenuOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        setCurrentLanguage(i18n.resolvedLanguage);
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const languageOptions = Object.keys(globalConst.languages).map(key => {
        return (
            <button
                key={key}
                className={`${styles.languageOption} ${currentLanguage === key ? styles.active : ""}`}
                onClick={() => changeLanguage(key)}
                disabled={currentLanguage === key}
            >
                <span className={styles.flag}>
                    <Image
                        alt=""
                        src={globalConst.languages[key].flagpath}
                        height={24}
                        width={18}
                    />
                </span>
                <span>{t(globalConst.languages[key].translationkey)}</span>
            </button>
        );
    });

    return (

        <div className={styles.languageSwitcher} ref={dropdownRef}>
            {currentLanguage && (
                <>
                    <button
                        className={styles.flagButton}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label={t('languageswitch.currentlanguage') + ' ' + t(globalConst.languages[currentLanguage].translationkey)}
                    >
                        <span className={styles.flag}>
                            <Image
                                alt=""
                                src={globalConst.languages[currentLanguage].flagpath}
                                height={24}
                                width={18}
                            />
                        </span>
                    </button>

                    {isMenuOpen && (
                        <div className={styles.dropdown}>
                            <h4>{t('languageswitch.switchlanguage')}</h4>
                            {languageOptions}
                        </div>
                    )}
                </>
            )}
        </div >
    );
}
