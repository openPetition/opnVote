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
import styles from "./styles/CreateSecret.module.css";
import qr_styles from "@/styles/ScanUploadQRCode.module.css";
import navigationbox_styles from "@/styles/NavigationBox.module.css";
import NextImage from "next/image";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";

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

                    progressBarStep={globalConst.progressBarStep.key}
                />
            </div>
            <main className="op__contentbox_760">
                {!createSecretState.showKeyCheck ? (
                    <>
                        {!createSecretState.showSecret && (
                            <>
                                <LoadKey
                                    onClickAction={generateAndCreate}
                                    animationDuration={1}
                                    showLoadingAnimation={createSecretState.loadingAnimation}
                                />
                                <div>
                                    <h3 className={styles.title}> {t('secret.key.existingKey')} </h3>
                                    <div style={{ scrollMarginTop: "60px" }}>
                                        <div className="flex op__gap_10_small op__gap_30_wide op__flex_direction_row_wide op__flex_direction_column_small">
                                            <div className="op__outerbox_grey go_to_upload op__flex_grow_standard op__width_100 op__flex_center_align op__flex"
                                                onClick={() => {
                                                    setCreateSecretState({
                                                        ...createSecretState,
                                                        showKeyCheck: true,
                                                    })
                                                }}>
                                                <div className={`${navigationbox_styles.innerbox} op__width_100`} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                                                    <div className="flex op__gap_30" >
                                                        <div className={qr_styles.qrbg}>
                                                            <NextImage
                                                                priority
                                                                src="/images/load-picture.svg"
                                                                height={60}
                                                                width={60}
                                                                alt=""
                                                            />
                                                        </div>
                                                        <div>
                                                            <h3>{t('scanuploadqrcode.image.headline')}</h3>
                                                            <p>{t('register.uploadqrcode.scanSubHeadline')}</p>
                                                        </div>

                                                    </div>
                                                </div>
                                            </div>
                                            <div className="op__outerbox_grey go_to_upload op__flex_grow_standard op__width_100 op__flex_center_align op__flex"
                                                onClick={() => {
                                                    setCreateSecretState({
                                                        ...createSecretState,
                                                        showKeyCheck: true,
                                                    })
                                                }}>
                                                <div className={`${navigationbox_styles.innerbox} op__width_100`} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                                                    <div className="flex op__gap_30">
                                                        <div className={qr_styles.qrbg}>
                                                            <NextImage
                                                                priority
                                                                src="/images/scan-qrcode.svg"
                                                                height={60}
                                                                width={60}
                                                                alt=""
                                                            />
                                                        </div>
                                                        <div>
                                                            <h3>{t('scanuploadqrcode.button.camera.headline')}</h3>
                                                            <p>{t('scanuploadqrcode.button.camera.subheadline.votingkey')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>

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
                                {!user.keySaved && (
                                    <Modal
                                        showModal={showMod}
                                        headerText={t('secret.notification.success.popup.headline')}
                                        ctaButtonText={t('secret.notification.success.popup.understand')}
                                        ctaButtonFunction={() => setShowMod(false)}
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
                                )}

                            </>
                        )}

                    </>
                ) : (
                    <>
                        <ScanUploadQRCode
                            headline={t("register.uploadqrcode.headline")}
                            subheadline={t("register.uploadqrcode.subheadline")}
                            uploadSubHeadline={t("register.uploadqrcode.uploadSubHeadline")}
                            scanSubHeadline={t("register.uploadqrcode.scanSubHeadline")}
                            onResult={(res) => updateUserKey(res, true)}
                        />
                        <button
                            onClick={() => {
                                setCreateSecretState({
                                    ...createSecretState,
                                    showKeyCheck: false,
                                })
                            }}
                            className={`${btn_styles.secondary} ${btn_styles.btn}`}
                        >
                            {t("common.back")}

                        </button>
                    </>
                )}
            </main>
        </>
    );
}
