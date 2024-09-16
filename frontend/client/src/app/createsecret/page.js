'use client';
import React, { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "@/components/NavigationBox";
import Notification from "../../components/Notification";
import LoadKey from "./components/Key";

export default function Home() {
    const [secret, setSecret] = useState('');
    const [ electionId, setElectionId ] = useState();
    const [ jwt, setJwt ] = useState();

    const [ createSecretStationState, setCcreateSecretStationState ] = useState({
        loadingAnimation: false,
        showSecret: false,
        showNotification: false,
        notificationText: '',
        notificationType: ''
    });

    const goToRegister = () => {
        window.location.href = "/register?id=" + electionId + '&jwt=' + jwt; 
    }

    const goToPollingstation = () => {
        window.location.href = "/pollingstation?id=" + electionId;
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function generateAndCreate() {
        setCcreateSecretStationState({
            ...createSecretStationState,
            loadingAnimation: true,
        })
        
        const masterTokenAndR = await generateMasterTokenAndMasterR();
        const createdSecret = await concatTokenAndRForQR(masterTokenAndR.masterToken, masterTokenAndR.masterR);
        await delay(1000); // one second for loading the key
        if (createdSecret) {
            setSecret(createdSecret);
            setCcreateSecretStationState({
                ...createSecretStationState,
                loadingAnimation: false,
                showQuestions: true,
                showSecret: true,
                showNotification: true,
                notificationType: 'confirm',
                notificationText: 'Ihr Wahlschein für diese Wahl wurde anerkannt. Sie können jetzt Ihre Auswahl treffen.'
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
                </div>
            </div>

            <main className="op__contentbox_760">
                {!createSecretStationState.showSecret && (
                    <>
                        <LoadKey
                            onClickAction={generateAndCreate}
                            animationDuration={1}
                            showLoadingAnimation={createSecretStationState.loadingAnimation}
                        />
                        {electionId && (
                            <>
                                <h3>Sie haben bereits Ihren Wahlschlüssel?</h3>
                                {jwt && (
                                    <NavigationBox
                                        onClickAction={() => goToRegister()}
                                        head="Wahlschein bestellen"
                                        text="Ich habe noch keinen Wahlschein und möchte einen bestellen"
                                        type="primary"
                                    />
                                )}
                                <NavigationBox
                                    onClickAction={() => goToPollingstation()}
                                    head="Direkt abstimmen"
                                    text="Ich habe meinen Wahlschein und möchte direkt abstimmen."
                                    type="primary"
                                />
                            </>
                        )}
                    </>
                )}
                {createSecretStationState.showSecret && (
                    <>
                        <Notification
                            type="success"
                            text="Ihr Wahlschlüssel wurde erfolgreich generiert. Jetzt müssen Sie es nur noch sicher ablegen."
                        />
                        <h4>Ihren Wahlschlüssel speichern</h4>
                        <Notification
                            type="info"
                            headline="Wichtig:"
                            text="Legen Sie ihren Wahlschlüssel lokal und sicher ab. Das Speichern ist sehr wichtig, denn ein einmal gespeichertes und verlorengegangenes Geheimnis kann von uns nicht wiederhergestellt werden und würde bedeuten, dass Sie ihre Stimme verlieren."
                        />
                        <GenerateQRCode
                            headline="Als Bild speichern"
                            subheadline="Sie können den QR-Code mit dem persönlichen Wahlschlüssel als Bild speichern."
                            text={secret}
                            downloadHeadline="Wahlschlüssel"
                        />
                    </>
                )}

            </main>
                
        </>
    );
}
