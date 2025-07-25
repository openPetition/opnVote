'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import LoadKey from "./components/Key";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import globalConst from "@/constants";
import styles from "./styles/CreateSecret.module.css";
import qr_styles from "@/styles/ScanUploadQRCode.module.css";
import navigationbox_styles from "@/styles/NavigationBox.module.css";
import NextImage from "next/image";

export default function CreateSecret() {
    const { t } = useTranslation();

    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
    });

    const { user, voting, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

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
            updateUserKey(createdSecret, false, true);
        }
    }

    useEffect(() => {
        if (user?.key?.length === 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
            });
        }

        if (user?.key?.length > 0) {
            updatePage({ current: globalConst.pages.SHOWKEY });
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
                                    updatePage({ current: globalConst.pages.LOADKEY });
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
                                    updatePage({ current: globalConst.pages.LOADKEY });
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

            </main>
        </>
    );
}
