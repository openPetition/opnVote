'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import Notification from "../../components/Notification";
import LoadKey from "./components/Key";
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
        keySaved: false
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
            });
        }

        if (user?.key?.length > 0) {
            setCreateSecretState({
                ...createSecretState,
                loadingAnimation: false,
                showSecret: true,
                showNotification: true,
            });
        }
    }, [user]);

    return (
        <>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    infoText={t("secret.headline.createSecret.infoText")}
                    image="/images/offline.svg"
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
                                <Notification
                                    type="success"
                                    text={t("secret.notification.success.text.key-generated")}
                                />
                                <h4 className="op__center">{t("secret.headline.savekey")}</h4>
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
                                    afterSaveFunction={() => {
                                        setCreateSecretState({
                                            ...createSecretState,
                                            keySaved: true
                                        });
                                    }}
                                />

                            </>
                        )}
                        {!isNaN(voting.electionId) && voting.jwt && (
                            <div className="op__center-align">
                                <Button
                                    onClickAction={() => goToRegister()}
                                    text={t("secret.navigationbox.gotoregister.aftergenerated.buttonText")}
                                    type="primary"
                                    isDisabled={(!(user?.key?.length > 0) || !createSecretState.keySaved)}
                                />
                            </div>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
