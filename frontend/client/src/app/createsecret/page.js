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

    const [secret, setSecret] = useState('');
    const [electionId, setElectionId] = useState();
    const [jwt, setJwt] = useState();
    const [createSecretState, setCreateSecretState] = useState({
        loadingAnimation: false,
        showSecret: false,
        showNotification: false,
    });

    const { user, updateUserKey } = useOpnVoteStore((state) => state);


    const goToRegister = () => {
        window.location.href = "/register?id=" + electionId + '&jwt=' + jwt;
    }

    const goToPollingstation = () => {
        window.location.href = "/pollingstation?id=" + electionId;
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
            setSecret(createdSecret);
            updateUserKey(createdSecret);
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showQuestions: true,
                showSecret: true,
                showNotification: true,
            })
        }
    }

    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        setElectionId(queryParameters.get("id"));
        setJwt(queryParameters.get("jwt"));
    }, [])

    return (
        <>
            <div className="bg-op-blue">
                <div className="flex-col items-center justify-between p-5 text-sm">
                    Dieser Part wird noch extrahiert.... nur zur Einteilung..
                    Die Generierung und Speicherung deines Geheimnisses erfolgt komplett „offline“. Wenn du ganz sicher gehen will, kannst du deine Internetverbindung jetzt deaktivieren und später wieder aktivieren.
                    {user?.key && (<>{user.key}</>)}
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

                        {electionId && jwt && (
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
                            text={secret}
                            downloadHeadline={t("secret.generateqrcode.downloadHeadline")}
                            headimage="secret"
                            saveButtonText={t("common.save")}
                        />
                        {electionId && jwt && (
                            <NavigationBox
                                onClickAction={() => goToRegister()}
                                head={t("secret.navigationbox.gotoregister.aftergenerated.head")}
                                text={t("secret.navigationbox.gotoregister.aftergenerated.text")}
                                type="primary"
                            />
                        )}
                    </>
                )}
                {electionId && (
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
