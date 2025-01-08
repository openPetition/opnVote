'use client';
import React, { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "@/components/NavigationBox";
import Notification from "../../components/Notification";
import LoadKey from "./components/Key";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";

export default function Home() {
    const { t } = useTranslation();

    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
        showNotification: false,
    });

    const { user, voting, updateUserKey } = useOpnVoteStore((state) => state);

    const goToRegister = () => {
        window.location.href = "/register?id=" + voting.electionId + '&jwt=' + voting.jwt;
    }

    const goToPollingstation = () => {
        window.location.href = "/pollingstation?id=" + voting.electionId;
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setCreateSecretState({
            ...createSecretState,
            loadingAnimation: true,
        })

        const masterTokenAndR = await generateMasterTokenAndMasterR();
        const createdSecret = await concatTokenAndRForQR(masterTokenAndR.masterToken, masterTokenAndR.masterR);
        await delay(1000); // one second for loading the key
        if (createdSecret) {
            updateUserKey(createdSecret);
        }
    }

    useEffect(() => {
        if (user?.key?.length === 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showSecret: false,
                showNotification: false,
            })
        }

        if (user?.key?.length > 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showSecret: true,
                showNotification: true,
            })
        }
    }, [user]);

    return (
        <>
            <div className="bg-op-blue">
                <div className="flex-col items-center justify-between p-5 text-sm">
                    Dieser Part wird noch extrahiert.... nur zur Einteilung..
                    Die Generierung und Speicherung deines Geheimnisses erfolgt komplett „offline“. Wenn du ganz sicher gehen will, kannst du deine Internetverbindung jetzt deaktivieren und später wieder aktivieren.
                </div>
            </div>

            <main className="op__contentbox_760">
                {!createSecretState.showSecret && (
                    <>
                        <LoadKey
                            onClickAction={generateAndCreate}
                            animationDuration={1}
                            showLoadingAnimation={createSecretState.loadingAnimation}
                        />

                        {voting.electionId && voting.jwt && (
                            <NavigationBox
                                onClickAction={() => goToRegister()}
                                head={t("secret.navigationbox.gotoregister.beforegenerated.head")}
                                text={t("secret.navigationbox.gotoregister.beforegenerated.text")}
                                type="primary"
                            />
                        )}
                    </>
                )}
                {createSecretState.showSecret && (
                    <>
                        <Notification
                            type="success"
                            text={t("secret.notification.success.text.key-generated")}
                        />
                        <h4>{t("secret.headline.savekey")}</h4>
                        <Notification
                            type="info"
                            headline={t("secret.notification.info.headline.important")}
                            text={t("secret.notification.info.text.important")}
                        />
                        <GenerateQRCode
                            headline={t("secret.generateqrcode.headline")}
                            subheadline={t("secret.generateqrcode.subheadline")}
                            text={user.key}
                            downloadHeadline={t("secret.generateqrcode.downloadHeadline")}
                            headimage="secret"
                            saveButtonText={t("common.save")}
                        />
                        {voting.electionId && voting.jwt && (
                            <NavigationBox
                                onClickAction={() => goToRegister()}
                                head={t("secret.navigationbox.gotoregister.aftergenerated.head")}
                                text={t("secret.navigationbox.gotoregister.aftergenerated.text")}
                                type="primary"
                            />
                        )}
                    </>
                )}
                {voting.electionId && (
                    <>
                        <NavigationBox
                            onClickAction={() => goToPollingstation()}
                            head={t("secret.navigationbox.goToPollingstation.head")}
                            text={t("secret.navigationbox.goToPollingstation.text")}
                            type="primary"
                        />
                    </>
                )}

            </main>

        </>
    );
}
