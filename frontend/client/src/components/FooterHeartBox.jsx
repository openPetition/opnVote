'use client';

import styles from '../styles/FooterHeartBox.module.css';
import { Heart } from 'lucide-react';
import { useTranslation } from "next-i18next";

export default function FooterHeartBox() {
    const { t } = useTranslation();

    return (
        <>
            <div className={styles.box}>
                <div className={styles.blueheartbox}>
                    <div className={styles.heart}>
                        <Heart fill="#fff" size={32} />
                    </div>
                    <p className={styles.textblock}>
                        {t('footer.loveforopnvote.text')}
                    </p>
                </div>
            </div>
        </>
    );
}
