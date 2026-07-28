'use client';
import { useState, useEffect } from "react";
import LoadKey from "./components/LoadKey";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import globalConst from "@/constants";
import styles from "./styles/CreateSecret.module.css";
import Notification from "@/components/Notification";
import ErrorPopup from "@/components/ErrorPopup";
import { SecurityKeyGenerationError } from "@/errors";

export default function CreateSecret() {
    const { t } = useTranslation();

    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
    });
    const [keyGenerationErrorDetails, setKeyGenerationErrorDetails] = useState(null);
    const [errorPopup, setErrorPopup] = useState(null);

    const { user, voting, updateUserKey, updatePage, voteClient } = useOpnVoteStore((state) => state);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setKeyGenerationErrorDetails(null);
        setCreateSecretState({
            ...createSecretState,
            loadingAnimation: true,
        });

        let createdSecret = null;

        try {
            if (!voteClient || typeof voteClient.generateMasterKey !== 'function') {
                throw new Error('Vote client is not ready to generate a security key.');
            }

            let masterKey = await voteClient.generateMasterKey();
            createdSecret = voteClient.exportMasterKey(masterKey);
        } catch (error) {
            const userError = new SecurityKeyGenerationError();
            setKeyGenerationErrorDetails({
                userError,
                location: userError.title,
                module: 'CreateSecret',
                block: 'generateAndCreate',
                technicalDetails: error instanceof Error
                    ? error.message || error.name
                    : t('errorpopup.technicaldetails.unavailable'),
            });
            console.error("Failed to generate master key via client:", error);
        }

        await delay(1000); // one second for loading the key

        if (createdSecret) {
            updateUserKey(createdSecret, false);

        } else {
            setCreateSecretState(prev => ({ ...prev, loadingAnimation: false }));
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
    }, [user?.key]);

    return (
        <>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    progressBarStep={globalConst.progressBarStep.createKey}
                />
            </div>
            <main className="op__contentbox_760">
                <LoadKey
                    onClick={generateAndCreate}
                    animationDuration={1}
                    showLoadingAnimation={createSecretState.loadingAnimation}
                />
                {keyGenerationErrorDetails && (
                    <Notification
                        type="error"
                        text={t(keyGenerationErrorDetails.userError.text)}
                        linkText={t('secret.error.generation.link')}
                        linkAction={() => setErrorPopup(keyGenerationErrorDetails)}
                    />
                )}
                <a className={styles.link} onClick={() => {
                    updatePage({ current: globalConst.pages.LOADKEY });
                }}>
                    <p>{t('secret.key.existingKey')}</p>
                </a>
            </main>
            <ErrorPopup error={errorPopup} onClose={() => setErrorPopup(null)} />
        </>
    );
}
