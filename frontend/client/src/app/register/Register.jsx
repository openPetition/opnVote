'use client';

import { useState, useEffect } from "react";

import NextImage from 'next/image';
import Notification from "../../components/Notification";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import HtmlQRCodePlugin from "../../components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "../../components/NavigationBox";
import Button from "../../components/Button";
import Cookies from 'universal-cookie';
import { getBlindedSignature } from '../../service';
import { useTranslation } from 'next-i18next';
import { qrToTokenAndR, deriveElectionUnblindedToken, deriveElectionR, blindToken, unblindSignature, createVoterCredentials, concatElectionCredentialsForQR, RSA_BIT_LENGTH } from "votingsystem";
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";

export default function Register() {
    const { t } = useTranslation();
    const { voting, updatePage } = useOpnVoteStore((state) => state);
    const [decodedValue, setDecodedValue] = useState("");
    const [voterQRCodeText, setVoterQRCodeText] = useState("");

    const delay = ms => new Promise(res => setTimeout(res, ms));
    // state of what to show and how far we came incl. noticiation cause they also can cause some change in view.

    const [registerState, setRegisterState] = useState({
        showLoading: false,
        showStartProcessScreen: true,
        showElectionInformation: true,
        showQRCodeUploadPlugin: false,
        showBallot: false,
        showContinueModal: false,
        showNotification: false,
        notificationText: '',
        notificationType: '',
        showQRLoadingAnimation: false,
        showVoteLater: false,
    });
    const cookies = new Cookies(null, { path: '/' });
    const generateVoteCredentials = async function () {
        setRegisterState({
            ...registerState,
            showLoading: true,
            showNotification: false,
        });

        try {
            let registerRSA = {
                N: BigInt(voting.election.registerPublicKeyN),
                e: BigInt(voting.election.registerPublicKeyE),
                NbitLength: Number(RSA_BIT_LENGTH),
            };

            let masterTokens = await qrToTokenAndR(decodedValue, true);
            let unblindedElectionToken = await deriveElectionUnblindedToken(voting.electionId, masterTokens.token);
            let electionR = await deriveElectionR(voting.electionId, masterTokens.r, unblindedElectionToken, registerRSA);
            let blindedElectionToken = await blindToken(unblindedElectionToken, electionR, registerRSA);
            let blindedSignature = await getBlindedSignature(voting.jwt, blindedElectionToken);
            let unblindedSignature = await unblindSignature(blindedSignature, electionR, registerRSA);
            let voterCredentials = await createVoterCredentials(unblindedSignature, unblindedElectionToken, masterTokens.token, voting.electionId);
            let qrVoterCredentials = await concatElectionCredentialsForQR(voterCredentials);
            setVoterQRCodeText(qrVoterCredentials);
            setRegisterState({
                ...registerState,
                showLoading: false,
                showBallot: false,
                showQRCodeUploadPlugin: false,
                showQRLoadingAnimation: true
            });
            await delay(1000);
            setRegisterState({
                ...registerState,
                showQRCodeUploadPlugin: false,
                showBallot: true,
                showQRLoadingAnimation: false,
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
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation');
    };

    const goToElection = function () {
        //set cookie with election data
        cookies.set('voterQR', voterQRCodeText);
        updatePage({ current: globalConst.pages.POLLINGSTATION });
    };

    const goToCreatesecret = () => {
        updatePage({ current: globalConst.pages.CREATEKEY });
    };

    const voteLater = function () {
        // later maybe redirect to overview of elections
        setRegisterState({
            ...registerState,
            showElectionInformation: false,
            showStartProcessScreen: false,
            showQRCodeUploadPlugin: false,
            showNotification: false,
            showBallot: false,
            showVoteLater: true,
        });
    };

    const activateQRCodeUpload = () => {
        setRegisterState({
            ...registerState,
            showStartProcessScreen: false,
            showQRCodeUploadPlugin: true,
            showNotification: false,
        });
    };

    useEffect(() => {
        // work with qr code value / decoded value in next step
        if (decodedValue && decodedValue.length > 0) {
            generateVoteCredentials();
        }
    }, [decodedValue]);

    return (
        <>
            <div className="op__contentbox_760">
                {(registerState.showLoading) && (
                    <>
                        <Loading loadingText={t("common.loading.text")} />
                    </>
                )}

                {registerState.showElectionInformation && (
                    <>
                        <h3>{t("register.headline.orderballot")}</h3>
                        <p>
                            {t("register.text.ballotdescription")}
                        </p>
                        <div className="op__outerbox_grey">
                            <h3>{voting.electionInformation.title}</h3>
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

                {registerState.showElectionInformation && (
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
                                            buttonText={t("register.navigationbox.gotocreatesecret.buttonText")}
                                            type="primary"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {registerState.showQRCodeUploadPlugin && (
                            <>
                                <HtmlQRCodePlugin
                                    headline={t("register.uploadqrcode.headline")}
                                    subheadline={t("register.uploadqrcode.subheadline")}
                                    uploadSubHeadline={t("register.uploadqrcode.uploadSubHeadline")}
                                    scanSubHeadline={t("register.uploadqrcode.scanSubHeadline")}
                                    onResult={(res) => setDecodedValue(res)}
                                />
                            </>
                        )}

                        {registerState.showQRLoadingAnimation && (
                            <Loading loadingText={t("common.loading.text")} />
                        )}

                        {registerState.showBallot && (
                            <>
                                <Notification
                                    type="success"
                                    headline={t("register.notification.success.ballotcreated.headline")}
                                    text={t("register.notification.success.ballotcreated.text")}
                                />

                                <Notification
                                    type="info"
                                    headline={t("register.notification.attention.headline")}
                                    text={t("register.notification.attention.text")}
                                />

                                <div>
                                    <Button
                                        onClickAction={goToElection}
                                        text={t("register.button.gotoelection.text")}
                                        type="secondary"
                                    />
                                </div>

                                <GenerateQRCode
                                    headline={t("register.generateqrcode.headline")}
                                    subheadline={t("register.generateqrcode.subheadline")}
                                    text={voterQRCodeText}
                                    downloadHeadline={t("register.generateqrcode.downloadHeadline")}
                                    downloadSubHeadline={voting.electionInformation.title}
                                    headimage="ballot"
                                    saveButtonText={t("register.generateqrcode.savebuttontext")}
                                />

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

                                <ConfirmPopup
                                    showModal={registerState.showContinueModal}
                                    modalText={t("register.confirmpopup.modaltext")}
                                    modalHeader={t("register.confirmpopup.modalheader")}
                                    modalConfirmFunction={voteLater}
                                    modalAbortFunction={() => {
                                        window.scrollTo(0, 0);
                                        setRegisterState({
                                            ...registerState,
                                            showContinueModal: false
                                        });
                                    }}
                                    shouldConfirm={true}
                                    confirmMessage={t("register.confirmpopup.confirmmessage")}
                                />
                            </>
                        )}
                    </>
                )}
                {registerState.showVoteLater && (
                    <>
                        <Notification
                            type="info"
                            headline={t("register.notification.info.votelater.headline")}
                            text={t("register.notification.info.votelater.text")}
                        />

                        <div className="op__outerbox_grey">
                            <input
                                type="text"
                                readOnly={true}
                                defaultValue={`${Config.env.basicUrl}/?id=${voting.electionId}#pollingstation`}
                                style={{
                                    width: '90%',
                                    display: 'inline-block',
                                    paddingLeft: '10px',
                                    border: '1px solid #999',
                                    borderRadius: "5px",
                                    backgroundColor: '#eee'
                                }}
                            />
                            <NextImage
                                priority
                                src="/images/copy-clipboard.svg"
                                height={36}
                                width={36}
                                alt="Follow us on Twitter"
                                onClick={copyToClipboard}
                                style={{ display: 'inline-block', paddingLeft: '10px' }}
                            />
                        </div>

                        <div>
                            <Button
                                onClickAction={goToElection}
                                text={t("register.button.gotoelection.text")}
                                type="secondary"
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
