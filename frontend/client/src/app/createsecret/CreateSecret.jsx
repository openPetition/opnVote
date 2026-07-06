'use client';
import { useState, useEffect } from "react";
import LoadKey from "./components/LoadKey";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import globalConst from "@/constants";
import styles from "./styles/CreateSecret.module.css";

export default function CreateSecret() {
    const { t } = useTranslation();

    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
    });

    const { user, voting, updateUserKey, updatePage, voteClient } = useOpnVoteStore((state) => state);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setCreateSecretState({
            ...createSecretState,
            loadingAnimation: true,
        });

        let createdSecret = null;

        if (voteClient && typeof voteClient.generateMasterKey === 'function') {
            try {
                createdSecret = await voteClient.generateMasterKey();
            } catch (error) {
                console.error("Failed to generate master key via client:", error);
            }
        }

        await delay(1000); // one second for loading the key

        if (createdSecret) {
            setTimeout(() => {
                updateUserKey(createdSecret.hexString, false);
            }, 0);
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
            setTimeout(() => {
                updatePage({ current: globalConst.pages.SHOWKEY }, modes.replace);
            }, 0);
        }
    }, [user?.key, updatePage]);

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
                <a className={styles.link} onClick={() => {
                    updatePage({ current: globalConst.pages.LOADKEY });
                }}>
                    <p>{t('secret.key.existingKey')}</p>
                </a>
            </main>
        </>
    );
}