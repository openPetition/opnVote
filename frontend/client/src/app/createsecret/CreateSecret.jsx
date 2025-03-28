'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "@/components/NavigationBox";
import Notification from "../../components/Notification";
import LoadKey from "./components/Key";
import Keycheck from "./components/Keycheck";
import Button from "@/components/Button";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import Headline from "@/components/Headline";

export default function CreateSecret() {
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
    }

    const goToPollingstation = () => {
        updatePage({ current: globalConst.pages.POLLINGSTATION });
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
            <Headline
                title={t("secret.headline.createSecret.title")}
                text={t("secret.headline.createSecret.text")}
                infoText={t("secret.headline.createSecret.infoText")}
                image="/images/offline.svg"
            />

            <main className="op__contentbox_760">
                {!createSecretState.showKeyCheck && (
                    <>
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
                                        buttonText={t("secret.navigationbox.gotoregister.beforegenerated.buttonText")}
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
                                    afterSaveFunction={() => { }}
                                />
                                <Button
                                    onClickAction={() =>
                                        setCreateSecretState({
                                            ...createSecretState,
                                            showKeyCheck: true
                                        })}
                                    text={"weiter zur Prüfung"}
                                    type="primary"
                                />
                                {voting.electionId && voting.jwt && (
                                    <NavigationBox
                                        onClickAction={() => goToRegister()}
                                        head={t("secret.navigationbox.gotoregister.aftergenerated.head")}
                                        text={t("secret.navigationbox.gotoregister.aftergenerated.text")}
                                        buttonText={t("secret.navigationbox.gotoregister.aftergenerated.buttonText")}
                                        type="primary"
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
                {createSecretState.showKeyCheck && (
                    <>
                        <Keycheck />
                        <Button
                            onClickAction={() =>
                                setCreateSecretState({
                                    ...createSecretState,
                                    showKeyCheck: false
                                })}
                            text={t("keycheck.backToSecretCreation")}
                            type="primary"
                        />
                    </>
                )}
                {voting.electionId && (
                    <>
                        <NavigationBox
                            onClickAction={() => goToPollingstation()}
                            head={t("secret.navigationbox.goToPollingstation.head")}
                            text={t("secret.navigationbox.goToPollingstation.text")}
                            buttonText={t("secret.navigationbox.goToPollingstation.buttonText")}
                            type="primary"
                        />
                    </>
                )}
            </main>
        </>
    );
}
