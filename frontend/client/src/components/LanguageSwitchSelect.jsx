"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import styles from "./../styles/LanguageSwitchSelect.module.css";
import Image from "next/image";
import globalConst from "@/constants";

export default function LanguageSwitchSelect() {
    const { t } = useTranslation();
    const { i18n } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.resolvedLanguage);

    const changeLanguage = (event) => {
        const selectedCode = event.target.value
        i18n.changeLanguage(selectedCode);
    }

    const languageoptions = Object.keys(globalConst.languages).map(key => {
        return (
            <option key={key} value={key}> {t(globalConst.languages[key].translationkey)}</option>
        )
    })

    return (

        <div className={styles.container}>
            <div className={styles.selectWrapper}>
                <label htmlFor="languagechangeselect">{t('navigation.changelanguage')}</label>
                <select id="languagechangeselect" className={styles.nativeSelect} value={currentLanguage} onChange={changeLanguage} name="language">
                    {languageoptions}
                </select>

                <div className={styles.styledSelect}>
                    <div className={styles.selectedOption}>
                        <span className={styles.flag}>
                            <Image
                                alt=""
                                src={globalConst.languages[currentLanguage].flagpath}
                                height={24}
                                width={18}
                            /></span>
                        <span className={styles.languageName}>{t(globalConst.languages[currentLanguage].translationkey)}</span>
                    </div>
                    <div className={styles.arrow}>▼</div>
                </div>
            </div>
        </div >
    );
}
