'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import LoadKey from "./components/Key";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
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
            updatePage({ current: globalConst.pages.SHOWKEY }, modes.replace);
        }
    }, [user]);

    return (
        <>
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

                <a className={styles.link} onClick={() => {
                    updatePage({ current: globalConst.pages.LOADKEY });
                }}>
                    <p>{t('secret.key.existingKey')}</p>
                </a>

            </main>
        </>
    );
}
