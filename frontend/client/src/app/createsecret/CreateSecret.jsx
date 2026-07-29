'use client';
import { useState, useEffect } from "react";
import LoadKey from "./components/LoadKey";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import Loading from "@/components/Loading";
import Button from "@/components/Button";
import Notification from "@/components/Notification";
import globalConst from "@/constants";
import styles from "./styles/CreateSecret.module.css";
import ErrorPopup from "@/components/ErrorPopup";
import { SecurityKeyGenerationError } from "@/errors";

export default function CreateSecret() {
    const { t } = useTranslation();

    const [localState, setLocalState] = useState({
        jwt: '',
        checkingRegistration: null,
        allowKeyCreation: false,
        loadingAnimation: false,
        showSecret: false,
    });
    const [keyGenerationErrorDetails, setKeyGenerationErrorDetails] = useState(null);
    const [errorPopup, setErrorPopup] = useState(null);

    const { user, voting, updateUserKey, updatePage, voteClient, updateVoting } = useOpnVoteStore((state) => state);

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setLocalState({
            ...localState,
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
            setLocalState(prev => ({ ...prev, loadingAnimation: false }));
        }
    }
    useEffect(() => {
        if (voteClient && typeof voteClient.checkRegistration === 'function' && voting.jwt && !user.key) {
            if (voting.jwt != localState.jwt || voting.isRegistered === null) {
                setLocalState({
                    ...localState,
                    jwt: voting.jwt,
                    checkingRegistration: true,
                });
            }
        }
    }, [voteClient, voting.jwt]);

    async function checkRegistration() {
        if (localState.checkingRegistration) {
            const result = await voteClient.checkRegistration({voterJwt: voting.jwt});

            // we assume non-registration if registration comes back with error, i.e. we assume
            // registration if and only if the result is .ok and the value is true
            const isRegistered = result.ok && result.value;
            updateVoting({
                ...voting,
                isRegistered: isRegistered,
            });
            setLocalState({
                ...localState,
                checkingRegistration: false,
                allowKeyCreation: !isRegistered,
            });
        }
    }

    useEffect(() => {
        checkRegistration();
    }, [localState.checkingRegistration, voting]);

    useEffect(() => {
        if (user?.key?.length === 0) {
            setLocalState({
                ...localState,
                checkingRegistration: true,
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
            {localState.allowKeyCreation ? (
                <main className="op__contentbox_760">
                    <LoadKey
                        onClick={generateAndCreate}
                        animationDuration={1}
                        showLoadingAnimation={localState.loadingAnimation}
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
            ) : ((localState.checkingRegistration === null || localState.checkingRegistration === true) ? (
                <main className="op__contentbox_760">
                    <Loading loadingText={t('secret.registrationcheck.text')}/>
                </main>
            ) : (
                <main className="op__contentbox_760">
                    <Notification type="error" headline={t('secret.alreadyregistered.headline')} text={t('secret.alreadyregistered.text')}>
                        <div className={`op__center-align op__margin_standard_top`} >
                            <Button
                                type="primary"
                                onClick={() => updatePage({ current: globalConst.pages.LOADKEY }, modes.replace)}
                            >{t('secret.alreadyregistered.loadkey')}</Button>
                            <Button
                                type="primary"
                                className={`op__margin_standard_left op__margin_standard_top`}
                                onClick={() => updatePage({ current: globalConst.pages.LOADBALLOT }, modes.replace)}
                            >{t('secret.alreadyregistered.loadballot')}</Button>
                        </div>
                    </Notification>
                </main>
            ))}
            <ErrorPopup error={errorPopup} onClose={() => setErrorPopup(null)} />
        </>
    );
}
