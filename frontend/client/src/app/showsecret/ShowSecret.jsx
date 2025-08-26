'use client';
import btn_styles from "@/styles/Button.module.css";
import GenerateQRCode from "../../components/GenerateQRCode";
import Notification from "../../components/Notification";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import { ArrowRightIcon } from "lucide-react";
import Modal from '@/components/Modal';
import globalConst from "@/constants";
import { createPDF } from "@/save-pdf";
import { useEffect } from "react";


export default function ShowSecret() {
    const { t } = useTranslation();
    const { user, voting, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

    const goToRegister = () => {
        updatePage({ current: globalConst.pages.REGISTER });
    };

    useEffect(() => {
        if (user?.key?.length === 0) {
            updatePage({ current: globalConst.pages.CREATEKEY });
        }
    }, [])

    return (
        <>
            <div>
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
                        downloadFilename={t("secret.generateqrcode.downloadFilename", { CREATIONDATE: new Date().toISOString().split('T')[0] })}
                        headimage="key-no-whitespace"
                        saveButtonText={t("secret.generateqrcode.savebuttontext")}
                        saved={user.keySaved}
                        qrCodeString={user.key}
                        pdfQRtype={globalConst.pdfType.VOTINGKEY}
                        afterSaveFunction={() => updateUserKey(user.key, true, false)}
                    />
                    {!isNaN(voting.electionId) && voting.jwt && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.875rem' }}>
                            <button
                                onClick={() => goToRegister()}
                                disabled={!user.keySaved}
                                className={`${btn_styles.primary} ${btn_styles.btn}`}
                                style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'flex-end' }}
                            >
                                {t("secret.navigationbox.gotoregister.aftergenerated.buttonText")}
                                <div style={{ alignSelf: 'center' }}>
                                    {
                                        (!user.keySaved)
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
                        ctaButtonFunction={() => {
                            updateUserKey(user.key, true, false);
                            createPDF(
                                user.key,
                                (t("secret.generateqrcode.downloadHeadline")).toUpperCase(),
                                '',
                                t("secret.generateqrcode.downloadFilename", { CREATIONDATE: new Date().toISOString().split('T')[0] }),
                                globalConst.pdfType.VOTINGKEY,
                                {}
                            );

                        }}
                    >
                        <Notification
                            type="success"
                            text={t("secret.notification.success.text.key-generated")}
                        />

                        <p style={{ marginTop: '1rem' }}>
                            <span style={{ textTransform: 'uppercase', fontSize: '1rem', color: '#c10315', fontWeight: 'bold', marginRight: '0.5em' }}>
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
