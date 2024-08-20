'use client';

import React, { useState, useEffect } from "react";

import Alert from "../../components/Alert";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import Cookies from 'universal-cookie';
import { useLazyQuery, gql } from '@apollo/client';
import Link from 'next/link';
import axios from 'axios';

import { generateKeyPairRaw, qrToTokenAndR, deriveElectionUnblindedToken, deriveElectionR, blindToken, unblindSignature, createVoterCredentials, concatElectionCredentialsForQR  } from "votingsystem";

const GET_ELECTION = gql`
    query election($id: ID!) {
        election(id: $id)  {
        id,
        totalVotes,
        startTime,
        endTime,
        descriptionBlob
    }
}`;

export default function Home() {

    const [ decodedValue, setDecodedValue ] = useState("");
    const [ voterQRCodeText, setVoterQRCodeText ] = useState("")
    const [ electionId, setElectionId ] = useState();

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

    const getBlindedSignature = async function (blindedElectionToken) {
        // jwt should be get at earlier stage later - now just here for better testing 
        // no upload and call without jwt token
        const queryParameters = new URLSearchParams(window.location.search);
        const token = queryParameters.get("jwt");
        const blindedElectionTokenFormatted = {token: blindedElectionToken}
        const signOptions = {
            method: "POST",
            headers: new Headers(
                {
                    'content-type': 'application/json',
                    'Authorization': 'Bearer '+ token 
                }
            ),
            body: JSON.stringify(blindedElectionTokenFormatted),
        };
     
        const response = await fetch("https://152.53.65.200:3004/api/sign", signOptions);

        return response.data.blindedSignature;
    }

    const generateVoteCredentials = async function() {
        setRegisterState({
            ...registerState,
            showLoading: true,
            showNotification: false,
        });
        const electionId = data?.election?.id;
        try {
            let RSA = await generateKeyPairRaw();
            let masterTokens  = await qrToTokenAndR(decodedValue, true);
            let unblindedElectionToken = await deriveElectionUnblindedToken(electionId, masterTokens.token);
            let electionR = await deriveElectionR(data?.election?.id, masterTokens.r, unblindedElectionToken, RSA);
            let blindedElectionToken = await blindToken(unblindedElectionToken, electionR, RSA);
            let blindedSignature = await getBlindedSignature(blindedElectionToken);
            let unblindedSignature = await unblindSignature(blindedSignature, electionR, RSA);
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

    const [getElection, { loading, data }]  = useLazyQuery(GET_ELECTION, { variables: { id: electionId } });

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
        
        if (queryParameters && getId && !Number.isInteger(parseInt(getId, 10))) {
            setRegisterState({
                ...registerState,
                showLoading: false,
                showNotification: true,
                notificationText: 'Es wurde keine Wahl ID gefunden.',
                notificationType: 'error'
            })
            return;
        }
        setElectionId(queryParameters.get("id"));
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
                    <Alert
                        alertType={registerState.notificationType}
                        alertText={registerState.notificationText}
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
                                    <Link className="inline-block m-2 p-2 bg-stone-100 border border-stone-300 text-black hover:border-transparent rounded" href="/createsecret">
                                        <h2 className="text-sm font-semibold">Ich habe kein Wahlgeheimnis oder möchte ein neues generieren</h2>
                                        <p className="text-xs">Wenn Sie noch kein Wahlgeheimnis besitzen oder es verloren haben, können Sie sich in wenigen Schritten eines generieren.</p>
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}

                    {registerState.showQRCodeUploadPlugin && (
                        <>
                            <HtmlQRCodePlugin
                                headline = "Wahlgeheimnis prüfen"
                                subheadline = "Bitte wählen Sie Ihr gespeichertes Wahlgeheimnis aus, um dessen Besitz nachzuweisen!"
                                uploadSubHeadline = "Sie können Ihr Wahlgeheimnis ganz einfach hier als Bild laden und prüfen lassen."
                                scanSubHeadline = "Sie können Ihr Wahlgeheimnis ganz einfach über Ihre Geräte-Kamera prüfen lassen."
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
