'use client';

import React, { useState, useEffect } from "react";

import Notification from "../../components/Notification";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "../../components/NavigationBox";
import Cookies from 'universal-cookie';
import Link from 'next/link';
import { getBlindedSignature } from '../../service';
import { getElectionData } from '../../service-graphql';

import { qrToTokenAndR, deriveElectionUnblindedToken, deriveElectionR, blindToken, unblindSignature, createVoterCredentials, concatElectionCredentialsForQR, RSA_BIT_LENGTH } from "votingsystem";

export default function Home() {

    const [ decodedValue, setDecodedValue ] = useState("");
    const [ voterQRCodeText, setVoterQRCodeText ] = useState("")
    const [ electionId, setElectionId ] = useState();
    const [ jwtToken, setJwtToken ] = useState();

    // state of what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [ registerState, setRegisterState ] = useState({
        showLoading: true,
        showStartProcessScreen: false,
        showElectionInformation: false,
        showElection: false,
        showQRCodeUploadPlugin: false,
        showBallot: false,
        showContinueModal: false,
        showNotification: false,
        notificationText: '',
        notificationType: ''
    });
    const cookies = new Cookies(null, { path: '/' });



    const generateVoteCredentials = async function() {
        setRegisterState({
            ...registerState,
            showLoading: true,
            showNotification: false,
        });
        const electionId = data?.election?.id;
        try {

            let registerRSA = {
                N: BigInt(data?.election?.registerPublicKeyN),
                e: BigInt(data?.election?.registerPublicKeyE),
                NbitLength: Number(RSA_BIT_LENGTH),
            };

            let masterTokens  = await qrToTokenAndR(decodedValue, true);
            let unblindedElectionToken = await deriveElectionUnblindedToken(electionId, masterTokens.token);
            let electionR = await deriveElectionR(data?.election?.id, masterTokens.r, unblindedElectionToken, registerRSA);
            let blindedElectionToken = await blindToken(unblindedElectionToken, electionR, registerRSA);
            let blindedSignature = await getBlindedSignature(jwtToken, blindedElectionToken);
            let unblindedSignature = await unblindSignature(blindedSignature, electionR, registerRSA);
            let voterCredentials = await createVoterCredentials(unblindedSignature, unblindedElectionToken, masterTokens.token, electionId);
            let qrVoterCredentials = await concatElectionCredentialsForQR(voterCredentials);
      
            setVoterQRCodeText(qrVoterCredentials);
            setRegisterState({
                ...registerState,
                showLoading: false,
                showBallot: true,
                showQRCodeUploadPlugin: false,
            });
        } catch (error) {
            setRegisterState({
                ...registerState,
                showLoading: false,
                showNotification: true,
                notificationText: 'Fehler bei der Verarbeitung des QR Code. ',
                notificationType: 'error'
            })
        };
    }

    const goToElection = function() {
        //set cookie with election data
        cookies.set('voterQR', voterQRCodeText);
        // will be changed to dynamic election location when its more clear where we go
        window.location.href = "/pollingstation?id=" + electionId;
    }

    const goToCreatesecret = () => {
        window.location.href = "/createsecret?id=" + electionId + '&jwt=' + jwtToken; 
    }

    const voteLater = function() {
        // later maybe redirect to overview of elections
        window.location.href = "https://openpetition.de/";
    }

    const activateQRCodeUpload = () => {
        setRegisterState({
            ...registerState,
            showStartProcessScreen: false,
            showQRCodeUploadPlugin: true,
            showNotification: false,
        })
    }

    useEffect(() => {
        // work with qr code value / decoded value in next step
        if (decodedValue && decodedValue.length > 0) {
            generateVoteCredentials()
        }
    }, [decodedValue]);

    const [getElection, { loading, data }]  = getElectionData(electionId);

    useEffect(() => {
        if (loading) return;

        // after we got election data .. check this
        if (data && data?.election && Object.keys(data?.election).length > 0) {
            setRegisterState({
                ...registerState,
                showElectionData: true,
                showStartProcessScreen: true,
                showLoading: false,
                showNotification: false,
            })
        }
    }, [data])

    useEffect(() => {
        if (!electionId) {
            return;
        }
        getElection();
    }, [electionId]);

    useEffect(() => {
        if (electionId || !window) {
            return;
        }

        const queryParameters = new URLSearchParams(window.location.search);
        const getId = queryParameters.get("id");
        const getJwtToken = queryParameters.get("jwt");

        if (queryParameters  && (!getId || !Number.isInteger(parseInt(getId, 10)) || !getJwtToken)) {
            setRegisterState({
                ...registerState,
                showLoading: false,
                showNotification: true,
                notificationText: 'Fehlerhafter Aufruf. Bitte  gehen Sie zurück und folgen dem vorherigen Link erneut!',
                notificationType: 'error'
            })
            return;
        }

        setElectionId(getId);
        setJwtToken(getJwtToken);
    }, []);

    return (
        <>
            {(loading || registerState.showLoading) && (
                <>
                    <Loading loadingText="Loading"/>
                </>
            )}

            {registerState.showElectionData && (
                <>
                    <div className="bg-op-grey-light">
                        <div className="p-4">
                            <h3 className="text-center font-bold py-2">Wahlschein bestellen</h3>
                            <p>
                                Mithilfe des Wahlscheins prüft die Wahlleitung Ihre Wahlberechtigung. Daui wird ihr Wahlgeheimnis lokal verschlüsselt und dann an die Wahlleitung hochgeladen.
                            </p>
                            <p>Abstimmungsdaten: {data?.election?.descriptionBlob}</p>
                        </div>
                    </div>
                </>
            )}

            {registerState.showNotification && (
                <>
                    <Notification
                        type={registerState.notificationType}
                        text={registerState.notificationText}
                    />
                </>
            )}

            {registerState.showElectionData && (
                <>
                    {registerState.showStartProcessScreen && (
                        <>
                            <button onClick={activateQRCodeUpload} className="m-2 p-3 bg-op-blue-main border border-op-blue-main font-bold text-white hover:op-grey-light rounded">
                                WAHLSCHEIN GENERIEREN
                            </button>
                            <div className="flex items-center justify-center">
                                <div>
                                    <NavigationBox
                                        onClickAction={() => goToCreatesecret()}
                                        head="Ich habe keinen Wahlschlüssel oder möchte einen neuen generieren"
                                        text="Wenn Sie noch keinen Wahlschlüssel besitzen oder es verloren haben, können Sie sich in wenigen Schritten eines generieren."
                                        type="primary"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {registerState.showQRCodeUploadPlugin && (
                        <>
                            <HtmlQRCodePlugin
                                headline = "Wahlschlüssel prüfen"
                                subheadline = "Bitte wählen Sie Ihren gespeicherten Wahlschlüssel aus, um dessen Besitz nachzuweisen!"
                                uploadSubHeadline = "Sie können Ihren Wahlschlüssel ganz einfach hier als Bild laden und prüfen lassen."
                                scanSubHeadline = "Sie können Ihren Wahlschlüssel ganz einfach über Ihre Geräte-Kamera prüfen lassen."
                                onResult={(res) => setDecodedValue(res)}
                            />
                        </>
                    )}

                    {registerState.showBallot && (
                        <>
                            <GenerateQRCode
                                headline="Bild speichern"
                                subheadline="Sie können den QR-Code mit dem Wahlschein als Bild speichern."
                                text={voterQRCodeText}
                                downloadHeadline="Wahlschein"
                            />
                            <button onClick={goToElection} className="m-2 p-3 bg-white border border-op-blue-main font-bold text-op-blue-main hover:op-grey-light rounded">
                                ZUR WAHLKABINE
                            </button>
                            <button onClick={()=> {setShowContinueModal(true)}}  className="m-2 p-3 bg-op-blue-main border border-op-blue-main font-bold text-white hover:op-grey-light rounded">
                                SPÄTER ABSTIMMEN
                            </button>

                            <div className="flex p-2 m-2 text-sm text-black rounded w-[calc(100%-1rem)] bg-op-blue-light inline-block" role="alert">
                                <svg className="flex-shrink-0 inline w-4 h-4 me-3 mt-[2px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
                                </svg>
                                <div>
                                    <span className="font-bold">Achtung: </span>
                                    Wenn Sie nun direkt abstimmen, kann ggf. eine Verbindung zwischen Ihrer Stimme zu Ihrer Identität hergestellt werden. Stimmen Sie zu einem späteren Zeitpunkt und von einer anderen Internetverbindung ab, um eine geheime Wahl garantieren zu können und um Ihre Privatsphäre besser zu schützen.
                                </div>
                            </div>

                            <ConfirmPopup
                                showModal = {registerState.showContinueModal}
                                modalText = "Haben Sie Ihren Anonymen Wahlschein wirklich gespeichert oder ggf. abfotografiert? Nur mit Ihrem Anonymen Wahlschein können Sie an der Wahl teilnehmen."
                                modalHeader = "Haben Sie an alles gedacht?"
                                modalConfirmFunction = {voteLater}
                                modalAbortFunction = {
                                    ()=>{setRegisterState({
                                        ...registerState,
                                        showContinueModal: false,
                                    })}}
                                shouldConfirm = {true}
                                confirmMessage = "Ja, ich habe meinen Anonymen Wahlschein gespeichert."
                            />
                        </>
                    )}
                </>
            )}
        </>
    );
}
