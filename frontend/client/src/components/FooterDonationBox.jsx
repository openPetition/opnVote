'use client';

import styles from '../styles/FooterDonationBox.module.css';
import Button from './Button';
import { Heart } from 'lucide-react';
import { useTranslation } from "next-i18next";

export default function FooterDonationBox() {
    const { t } = useTranslation();

    return (
        <>
            <div className={styles.box}>
                <div className={styles.blueheartbox}>
                    <div className={styles.heart}>
                        <Heart fill="#fff" size={32} />
                    </div>
                    <p className={styles.textblock}>
                        {t('footer.donationbox.donationtext')}
                    </p>
                    <Button
                        onClickAction={() => { window.location = 'https://openpetition.org/spenden'; }}
                        type="dark"
                        text={t('footer.donationbox.donatenow')}
                        style={{ display: 'block', margin: '0 auto', marginTop: '1.5rem', fontWeight: 'bold', padding: '10px 15px', textTransform: 'uppercase' }}
                    />
                </div>
            </div>
        </>
    );
}
