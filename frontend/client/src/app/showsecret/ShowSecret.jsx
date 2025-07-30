'use client';
import { useState, useEffect } from "react";
import GenerateQRCode from "../../components/GenerateQRCode";
import Notification from "../../components/Notification";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import btn_styles from "@/styles/Button.module.css";
import { ArrowRightIcon } from "lucide-react";
import Modal from '@/components/Modal';
import globalConst from "@/constants";
import qr_styles from "@/styles/ScanUploadQRCode.module.css";
import navigationbox_styles from "@/styles/NavigationBox.module.css";
import NextImage from "next/image";

export default function CreateSecret() {
    const { t } = useTranslation();
    const { user, voting, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

    const goToRegister = () => {
        updatePage({ current: globalConst.pages.REGISTER });
    };

    if (user?.key?.length === 0) {
        updatePage({ current: globalConst.pages.CREATEKEY });
    }

    return (
        <>
            <title>{t("secret.title")}</title>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}

                    progressBarStep={globalConst.progressBarStep.key}
                />
            </div>
            <main className="op__contentbox_760">
                <>
                    <GenerateQRCode
                        headline={t("secret.generateqrcode.headline")}
                        text={user.key}
                        downloadHeadline={(t("secret.generateqrcode.downloadHeadline")).toUpperCase()}
                        headimage="key"
                        saveButtonText={t("secret.generateqrcode.savebuttontext")}
                        qrCodeString={user.key}
                        pdfQRtype={globalConst.pdfType.VOTINGKEY}
                        afterSaveFunction={() => updateUserKey(user.key, true, false)}
                    />
                    {!isNaN(voting.electionId) && voting.jwt && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.875rem' }}>
                            <button
                                onClick={() => goToRegister()}
                                disabled={(!(user?.key?.length > 0))}
                                className={`${btn_styles.primary} ${btn_styles.btn}`}
                                style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'flex-end' }}
                            >
                                {t("secret.navigationbox.gotoregister.aftergenerated.buttonText")}
                                <div style={{ alignSelf: 'center' }}>
                                    {
                                        (!(user?.key?.length > 0))
                                            ?
                                            <ArrowRightIcon stroke={'#c9c8c8'} strokeWidth={'3'} width={20} />
                                            :
                                            <ArrowRightIcon stroke={'white'} strokeWidth={'3'} width={20} />
                                    }
                                </div>
                            </button>
                        </div>
                    )}
                    <Modal
                        showModal={user.initKey}
                        headerText={t('secret.notification.success.popup.headline')}
                        ctaButtonText={t('secret.notification.success.popup.understand')}
                        ctaButtonFunction={() => updateUserKey(user.key, user.keySaved, false)}
                    >
                        <Notification
                            type="success"
                            text={t("secret.notification.success.text.key-generated")}
                        />

                        <p style={{ marginTop: '1rem' }}>
                            <span style={{ textTransform: 'uppercase', fontSize: '1rem', fontWeight: 'bold', marginRight: '0.5em' }}>
                                {t('secret.notification.info.headline.important')}
                            </span>
                            <span>
                                {t('secret.notification.info.text.important')}
                            </span>
                        </p>
                    </Modal>
                </>
            </main>
        </>
    );
}
