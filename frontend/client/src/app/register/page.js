'use client';

import React, { useState, useEffect } from "react";

import Notification from "../../components/Notification";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "../../components/NavigationBox";
import Button from "../../components/Button";
import Cookies from 'universal-cookie';
import { getBlindedSignature } from '../../service';
import { getElectionData } from '../../service-graphql';
import { useTranslation } from 'next-i18next';
import { qrToTokenAndR, deriveElectionUnblindedToken, deriveElectionR, blindToken, unblindSignature, createVoterCredentials, concatElectionCredentialsForQR, RSA_BIT_LENGTH } from "votingsystem";

export default function Home() {
    const { t } = useTranslation();
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
        
        try {

            let registerRSA = {
                N: BigInt(data?.election?.registerPublicKeyN),
                e: BigInt(data?.election?.registerPublicKeyE),
                NbitLength: Number(RSA_BIT_LENGTH),
            };

            let masterTokens  = await qrToTokenAndR(decodedValue, true);
            let unblindedElectionToken = await deriveElectionUnblindedToken(electionId, masterTokens.token);
            let electionR = await deriveElectionR(electionId, masterTokens.r, unblindedElectionToken, registerRSA);
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
            });
        };
    }

    const goToElection = function() {
        //set cookie with election data
        cookies.set('voterQR', voterQRCodeText);
        // will be changed to dynamic election location when its more clear where we go
        window.location.href = "/pollingstation?id=" + electionId;
    }

    const goToCreatesecret = () => {
        if (electionId && jwtToken) {
            window.location.href = "/createsecret?id=" + electionId + '&jwt=' + jwtToken; 
        }
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
                notificationText: t("register.notification.error.noelection.text"),
                notificationType: 'error'
            })
            return;
        }

        setElectionId(parseInt(getId));
        setJwtToken(getJwtToken);
    }, []);

    return (
        <>
            <div className="op__contentbox_760">
                {(loading || registerState.showLoading) && (
                    <>
                        <Loading loadingText={t("common.loading.text")}/>
                    </>
                )}

                {registerState.showElectionData && (
                    <>
                        <h3>{t("register.headline.orderballot")}</h3>
                        <p>
                            {t("register.text.ballotdescription")}
                        </p>
                        <div className="op__outerbox_grey">
                            <h3>{data?.election?.descriptionBlob}</h3>
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
                                <Button
                                    onClickAction={activateQRCodeUpload}
                                    text={t("register.button.orderballot")}
                                    type="primary"
                                />
                                <div className="flex items-center justify-center">
                                    <div>
                                        <NavigationBox
                                            onClickAction={goToCreatesecret}
                                            head={t("register.navigationbox.gotocreatesecret.head")}
                                            text={t("register.navigationbox.gotocreatesecret.text")}
                                            type="primary"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {registerState.showQRCodeUploadPlugin && (
                            <>
                                <HtmlQRCodePlugin
                                    headline = {t("register.uploadqrcode.headline")}
                                    subheadline = {t("register.uploadqrcode.subheadline")}
                                    uploadSubHeadline = {t("register.uploadqrcode.uploadSubHeadline")}
                                    scanSubHeadline = {t("register.uploadqrcode.scanSubHeadline")}
                                    onResult={(res) => setDecodedValue(res)}
                                />
                            </>
                        )}

                        {registerState.showBallot && (
                            <>
                                <GenerateQRCode
                                    headline={t("register.generateqrcode.headline")}
                                    subheadline={t("register.generateqrcode.subheadline")}
                                    text={voterQRCodeText}
                                    downloadHeadline={t("register.generateqrcode.downloadHeadline")}
                                />
                                
                                <div>
                                    <Button
                                        onClickAction={goToElection}
                                        text={t("register.button.gotoelection.text")}
                                        type="secondary"
                                    />
                                </div>

                                <div>
                                    <Button
                                        onClickAction={() =>                                         
                                            setRegisterState({
                                            ...registerState,
                                            showContinueModal: true
                                        })}
                                        text={t("register.button.votelater.text")}
                                        type="primary"
                                    />
                                </div>

                                <Notification
                                    type="info"
                                    headline={t("register.notification.attention.headline")}
                                    text={t("register.notification.attention.text")}
                                />

                                <ConfirmPopup
                                    showModal = {registerState.showContinueModal}
                                    modalText = {t("register.confirmpopup.modaltext")}
                                    modalHeader = {t("register.confirmpopup.modalheader")}
                                    modalConfirmFunction = {voteLater}
                                    modalAbortFunction = {() => {
                                        setRegisterState({
                                            ...registerState,
                                            showContinueModal: false
                                        })}}
                                    shouldConfirm = {true}
                                    confirmMessage = {t("register.confirmpopup.confirmmessage")}
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
