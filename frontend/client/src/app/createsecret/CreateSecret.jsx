'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import Notification from "../../components/Notification";
import LoadKey from "./components/Key";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import btn_styles from "@/styles/Button.module.css";
import { ArrowRightIcon } from "lucide-react";
import Modal from '@/components/Modal';
import globalConst from "@/constants";

export default function CreateSecret() {
    const [showMod, setShowMod] = useState(false);
    const { t } = useTranslation();

    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
        showNotification: false,
        showKeyCheck: false,
    });

    const { user, voting, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

    const goToRegister = () => {
        updatePage({ current: globalConst.pages.REGISTER });
    };

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setCreateSecretState({
            ...createSecretState,
            loadingAnimation: true,
        });

        const masterTokenAndR = await generateMasterTokenAndMasterR();
        const createdSecret = await concatTokenAndRForQR(masterTokenAndR.masterToken, masterTokenAndR.masterR);
        await delay(1000); // one second for loading the key
        if (createdSecret) {
            updateUserKey(createdSecret, false);
        }
    }

    useEffect(() => {
        if (user?.key?.length === 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showSecret: false,
                showNotification: false,
            });
        }

        if (user?.key?.length > 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showSecret: true,
                showNotification: true,
            });
            setShowMod(true);
        }
    }, [user]);

    return (
        <>
            <title>{t("secret.title")}</title>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    infoText={t("secret.headline.createSecret.infoText")}
                    image="/images/offline.svg"
                    progressBarStep={globalConst.progressBarSteps.key}
                />
            </div>
            <main className="op__contentbox_760">
                {!createSecretState.showKeyCheck && (
                    <>
                        {!createSecretState.showSecret && (
                            <LoadKey
                                onClickAction={generateAndCreate}
                                animationDuration={1}
                                showLoadingAnimation={createSecretState.loadingAnimation}
                            />
                        )}
                        {createSecretState.showSecret && (
                            <>
                                <GenerateQRCode
                                    headline={t("secret.generateqrcode.headline")}
                                    text={user.key}
                                    downloadHeadline={(t("secret.generateqrcode.downloadHeadline")).toUpperCase()}
                                    headimage="key"
                                    saveButtonText={t("secret.generateqrcode.savebuttontext")}
                                    qrCodeString={user.key}
                                    pdfQRtype={globalConst.pdfType.VOTINGKEY}
                                    afterSaveFunction={() => {
                                        updateUserKey(user.key, true)
                                    }}
                                />
                                {!user.keySaved && (
                                    <Modal
                                        showModal={showMod}
                                        headerText={t('secret.notification.success.popup.headline')}
                                        ctaButtonText={t('secret.notification.success.popup.understand')}
                                        ctaButtonFunction={() => setShowMod(false)}
                                    >
                                        <Notification
                                            type="success_blue_bg"
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
                                )}

                            </>
                        )}
                        {!isNaN(voting.electionId) && voting.jwt && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                    </>
                )}
            </main>
        </>
    );
}
