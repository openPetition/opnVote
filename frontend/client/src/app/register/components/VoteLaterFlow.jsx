'use client';

import NextImage from 'next/image';
import { useTranslation } from 'next-i18next';

import Button from '@/components/Button';
import ConfirmPopup from '@/components/ConfirmPopup';
import Notification from '@/components/Notification';

export function VoteLaterTrigger({ onOpen }) {
    const { t } = useTranslation();

    return (
        <div className="op__display_none_small op__display_none_wide">
            <Button
                onClick={onOpen}
                type="primary"
            >{t('register.button.votelater.text')}</Button>
        </div>
    );
}

export function VoteLaterConfirmation({ showModal, onConfirm, onAbort }) {
    const { t } = useTranslation();

    return (
        <ConfirmPopup
            showModal={showModal}
            modalText={t("register.confirmpopup.modaltext")}
            modalHeader={t("register.confirmpopup.modalheader")}
            modalConfirmFunction={onConfirm}
            modalAbortFunction={onAbort}
            shouldConfirm={false}
            confirmMessage={t("register.confirmpopup.confirmmessage")}
        />
    );
}

export function VoteLaterView({ pollingStationUrl, onGoToElection }) {
    const { t } = useTranslation();

    const copyToClipboard = () => {
        navigator.clipboard.writeText(pollingStationUrl);
    };

    return (
        <>
            <Notification
                type="info"
                headline={t("register.notification.info.votelater.headline")}
                text={t("register.notification.info.votelater.text")}
            />

            <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <input
                    type="text"
                    readOnly={true}
                    defaultValue={pollingStationUrl}
                    style={{
                        width: '90%',
                        display: 'inline-block',
                        paddingLeft: '10px',
                        border: '1px solid #999',
                        borderRadius: "5px",
                        backgroundColor: '#eee'
                    }}
                />
                <NextImage
                    priority
                    src="/images/copy-clipboard.svg"
                    height={36}
                    width={36}
                    alt="Follow us on Twitter"
                    onClick={copyToClipboard}
                    style={{ display: 'inline-block', paddingLeft: '10px' }}
                />
            </div>

            <div className="op__margin_standard_20_top_bottom">
                <Button
                    onClick={onGoToElection}
                    type="secondary"
                >{t("register.button.gotoelection.text")}</Button>
            </div>
        </>
    );
}
