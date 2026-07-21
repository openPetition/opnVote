'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import Modal from './Modal';
import Notification from './Notification';
import styles from '../styles/ErrorPopup.module.css';

const getClientInfo = (translate) => {
    const userAgent = navigator.userAgent;
    const browser = /Edg\//.test(userAgent) ? 'Microsoft Edge'
        : /Firefox\//.test(userAgent) ? 'Firefox'
            : /Chrome\//.test(userAgent) ? 'Google Chrome'
                : /Safari\//.test(userAgent) ? 'Safari'
                    : translate('errorpopup.technicaldetails.unknown');
    const operatingSystem = /Windows NT/.test(userAgent) ? 'Windows'
        : /Android/.test(userAgent) ? 'Android'
            : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
                : /Mac OS X/.test(userAgent) ? 'macOS'
                    : /Linux/.test(userAgent) ? 'Linux'
                        : translate('errorpopup.technicaldetails.unknown');
    const device = /iPad|Tablet/.test(userAgent) ? translate('errorpopup.technicaldetails.device.tablet')
        : /Mobi|Android|iPhone|iPod/.test(userAgent) ? translate('errorpopup.technicaldetails.device.mobile')
            : translate('errorpopup.technicaldetails.device.desktop');

    return { browser, operatingSystem, device, userAgent };
};

export default function ErrorPopup({ error, onClose, supportEmail = 'info@opn.vote' }) {
    const { t } = useTranslation();
    const [technicalDetailsCopied, setTechnicalDetailsCopied] = useState(false);
    const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);

    useEffect(() => {
        setTechnicalDetailsCopied(false);
        setTechnicalDetailsOpen(false);
    }, [error]);

    if (!error) {
        return null;
    }

    const clientInfo = getClientInfo(t);

    const technicalDetailItems = [
        { label: t('errorpopup.technicaldetails.notificationtitle'), value: t(error.userError.title) },
        { label: t('errorpopup.technicaldetails.notificationtext'), value: t(error.userError.text) },
        { label: t('errorpopup.technicaldetails.module'), value: error.module },
        { label: t('errorpopup.technicaldetails.block'), value: error.block },
        { label: t('errorpopup.technicaldetails.errorclass'), value: error.userError.constructor.name },
        { label: t('errorpopup.technicaldetails.error'), value: error.technicalDetails },
        { label: t('errorpopup.technicaldetails.browser'), value: clientInfo.browser },
        { label: t('errorpopup.technicaldetails.device'), value: clientInfo.device },
        { label: t('errorpopup.technicaldetails.operatingsystem'), value: clientInfo.operatingSystem },
        { label: t('errorpopup.technicaldetails.useragent'), value: clientInfo.userAgent },
    ];

    const getTechnicalDetailsText = () => technicalDetailItems
        .filter(({ value }) => value)
        .map(({ label, value }) => `${label}: ${value}`)
        .join('\n\n');

    const copyTechnicalDetails = async () => {
        if (!navigator.clipboard) {
            return;
        }

        try {
            await navigator.clipboard.writeText(getTechnicalDetailsText());
            setTechnicalDetailsCopied(true);
        } catch (caughtError) {
            console.debug('Could not copy technical error details:', caughtError);
        }
    };

    const getErrorReportMailto = () => {
        const body = [
            `${t('errorpopup.email.description')}\n\n`,
            t('errorpopup.email.technicaldetails'),
            getTechnicalDetailsText(),
        ].join('\n\n');

        return `mailto:${supportEmail}?subject=${encodeURIComponent(t('errorpopup.email.subject'))}&body=${encodeURIComponent(body)}`;
    };

    const dismissError = () => {
        setTechnicalDetailsCopied(false);
        setTechnicalDetailsOpen(false);
        onClose();
    };

    return (
        <Modal
            showModal={true}
            headerText={t(error.userError.title)}
            ctaButtonText={t(error.userError.button)}
            ctaButtonFunction={dismissError}
            onClose={dismissError}
        >
            <Notification
                type="error"
                headline={t(error.location)}
                text={t(error.userError.text)}
            />
            <p className={styles.errorSupportText}>{t('errorpopup.support')}</p>
            <a className={styles.errorReportEmailLink} href={getErrorReportMailto()}>
                <Mail size={18} />
                {t('errorpopup.email.link')}
            </a>
            <details
                className={styles.technicalDetails}
                onToggle={(event) => setTechnicalDetailsOpen(event.currentTarget.open)}
            >
                <summary>
                    {t(technicalDetailsOpen
                        ? 'errorpopup.technicaldetails.hide'
                        : 'errorpopup.technicaldetails.summary')}
                </summary>
                <div className={styles.technicalDetailsContent}>
                    <button
                        className={styles.copyTechnicalDetailsButton}
                        type="button"
                        onClick={copyTechnicalDetails}
                        title={t('errorpopup.technicaldetails.copy')}
                        aria-label={t('errorpopup.technicaldetails.copy')}
                    >
                        {technicalDetailsCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    {technicalDetailItems.map(({ label, value }) => (
                        <div className={styles.technicalDetail} key={label}>
                            <strong>{label}:</strong> <code>{value}</code>
                        </div>
                    ))}
                </div>
            </details>
        </Modal>
    );
}
