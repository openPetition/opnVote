'use client';

import { shallow } from "zustand/shallow";
import { useState, useEffect } from "react";

import NextImage from 'next/image';
import Notification from "../../components/Notification";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "../../components/NavigationBox";
import Button from "../../components/Button";
import { getBlindedSignature } from '../../service';
import { useTranslation } from 'next-i18next';
import { qrToTokenAndR, deriveElectionUnblindedToken, deriveElectionR, blindToken, unblindSignature, createVoterCredentials, concatElectionCredentialsForQR, RSA_BIT_LENGTH } from "votingsystem";
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import Headline from "@/components/Headline";
import Popup from "@/components/Popup";
import Modal from "@/components/Modal";
import CountDown from "@/app/pollingstation/components/CountDown";

export default function Register() {
    const { t } = useTranslation();
    const user = useOpnVoteStore((state) => state.user);

    const { voting, updateUserKey, updatePage, updateVoting } = useOpnVoteStore(
        (state) => state, shallow
    );
    const [decodedValue, setDecodedValue] = useState("");
    const [electionState, setElectionState] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [registerCode, setRegisterCode] = useState("");
    const [showMod, setShowMod] = useState(false);

    const election = voting.election
    const endDateFormatted = endDate.toLocaleString().slice(0, -3)
    const startDateFormatted = startDate.toLocaleString().slice(0, -3)

    const delay = ms => new Promise(res => setTimeout(res, ms));
    // state of what to show and how far we came incl. noticiation cause they also can cause some change in view.

    const [registerState, setRegisterState] = useState({
        showLoading: false,
        showStartProcessScreen: false,
        showElectionInformation: false,
        showQRCodeUploadPlugin: false,
        showBallot: false,
        showContinueModal: false,
        showNotification: false,
        notificationText: '',
        notificationType: '',
        showQRLoadingAnimation: false,
        showVoteLater: false,
        showSaveRegisterQRSuccess: false,
        errorType: ''
    });

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
            updateVoting({ registerCode: qrVoterCredentials });
            loadingQRchange();

        } catch (error) {
            let buttonFunction;
            let buttonText;
            let errorNotificationText;

            switch (error.message) {
                case globalConst.ERROR.JWTAUTH:
                    buttonFunction = goToStart;
                    buttonText = t('register.error.jwtauthbuttontext');
                    errorNotificationText = t('register.error.jwtauth');
                    break;
                case globalConst.ERROR.ALREADYREGISTERED:
                    buttonFunction = activateQRCodeUpload;
                    buttonText = t('register.error.alreadyregisteredbuttontext');
                    errorNotificationText = t('register.error.alreadyregistered');
                    break;
                default:
                    buttonFunction = '';
                    buttonText = '';
                    errorNotificationText = t('register.error.general');
            }

            setRegisterState({
                ...registerState,
                showLoading: false,
                showNotification: true,
                notificationText: errorNotificationText,
                notificationType: 'error',
                notificationButtonText: buttonText,
                notificationButtonAction: buttonFunction
            });
        };
    };

    // only loading animation
    const loadingQRchange = async function () {
        setRegisterState({
            ...registerState,
            showStartProcessScreen: false,
            showNotification: false,
            showLoading: false,
            showBallot: false,
            showQRCodeUploadPlugin: false,
            showQRLoadingAnimation: true
        });
        await delay(1000);
        setRegisterState({
            ...registerState,
            showElectionInformation: true,
            showQRCodeUploadPlugin: false,
            showBallot: true,
            showQRLoadingAnimation: false,
        });
        setShowMod(true);
    };

    const goToStart = () => {
        window.location = voting.electionInformation.backLink;
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation');
    };

    const goToElection = function () {
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
            showElectionInformation: true,
            showStartProcessScreen: false,
            showQRCodeUploadPlugin: true,
            showNotification: false,
            notificationButtonText: '',
        });
    };

    useEffect(() => {
        // work with qr code value / decoded value in next step
        if (decodedValue && decodedValue.length > 0) {
            setRegisterState({
                ...registerState,
                showStartProcessScreen: false,
                showNotification: false,
            });

            if (voting.registerCode.length == 0) {
                //has to generate registercode
                generateVoteCredentials();
            } else {
                //already has registercode
                loadingQRchange();
            }
        }
    }, [decodedValue]);


    useEffect(() => {
        if (registerCode && voting.registerCode != registerCode) {
            updateVoting({ registerCode: registerCode });
        }

    }, [registerCode]);

    useEffect(() => {

        const currentTime = Math.floor(new Date().getTime() / 1000);
        const tempStartTime = new Date(Number(voting.election.startTime) * 1000);
        const tempEndTime = new Date(Number(voting.election.endTime) * 1000);
        setStartDate(tempStartTime);
        setEndDate(tempEndTime);
        const state = Number(currentTime) < Number(voting.election.startTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(voting.election.endTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
        setElectionState(state);

        // register already given? only show it
        if (voting.registerCode.length > 0) {
            loadingQRchange();
            return;
        };

        // user key already given - use it to generate register
        if (user.key.length > 0) {
            setDecodedValue(user.key);
            return;
        };

        // nothing given - upload key flow
        setRegisterState({
            ...registerState,
            showElectionInformation: true,
            showStartProcessScreen: true,
            showNotification: false,
        });

    }, []);

    return (
        <>
            <Modal
                showModal={showMod}
                headerText={t("register.popup.aftersave.headline")}
                ctaButtonText={t("register.popup.aftersave.buttontext")}
                ctaButtonFunction={() => {
                    window.scrollTo(0, 0);
                    setShowMod(false);
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Notification
                        type="success"
                        text={t("register.notification.aftersave.text")}
                    />
                    {<div dangerouslySetInnerHTML={{ __html: t("register.popup.aftersave.infotext") }} />}
                    <div style={{ backgroundColor: '#efefef', borderRadius: '4px', padding: '10px' }}>
                        <div className="op__contentbox_max">
                            {(electionState !== "finished") ?
                                election.startTime > Date.now() ?
                                    <>
                                        <CountDown
                                            countDownEndTime={electionState === globalConst.electionState.ONGOING ? election.endTime : election.startTime}
                                            countDownHeadLine={t('pollingstation.electionheader.countdown.headline.' + electionState)}
                                            countDownState={'planned'}
                                            electionStartDate={election.startTime}
                                            electionEndDate={election.endTime}
                                        />
                                        <div style={{ textAlign: 'center', fontSize: '13px' }}>
                                            {<div dangerouslySetInnerHTML={{ __html: t("register.countdown.election.start", { ENDDATE: startDate }) }} />}
                                        </div>
                                    </>
                                    :
                                    <>
                                        <CountDown
                                            countDownEndTime={electionState === globalConst.electionState.ONGOING ? election.endTime : election.startTime}
                                            countDownHeadLine={t('pollingstation.electionheader.countdown.headline.' + electionState)}
                                            countDownState={'ongoing'}
                                            electionStartDate={election.startTime}
                                            electionEndDate={election.endTime}
                                        />
                                        <div style={{ textAlign: 'center', fontSize: '13px' }}>
                                            {<div dangerouslySetInnerHTML={{ __html: t("register.countdown.election.end", { ENDDATE: endDate }) }} />}
                                        </div>
                                    </>
                                : <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{t("pollingstation.electionHeader.statetitle.finished").toUpperCase()}</div>
                            }
                        </div>
                    </div>
                </div>
            </Modal>

            <title>{t("register.title")}</title>
            <>
                <Headline
                    title={t("register.headline.title")}
                    text={t("register.headline.text")}
                    infoText={registerState.showBallot ? '' : t("register.headline.infoText")}
                    image="/images/online.svg"
                    progressBarStep={globalConst.progressBarStep.ballot}
                />
            </>

            <div className="op__contentbox_760">

                {(registerState.showLoading) && (
                    <>
                        <Loading loadingText={t("common.loading.text")} />
                    </>
                )}

                {registerState.showNotification && (
                    <>
                        <Notification
                            type={registerState.notificationType}
                            text={registerState.notificationText}
                            buttonText={registerState.notificationButtonText}
                            buttonAction={registerState.notificationButtonAction}
                        />
                    </>
                )}

                {registerState.showQRLoadingAnimation && (
                    <Loading loadingText={t("common.loading.text")} />
                )}

                {registerState.showElectionInformation && (
                    <>
                        {registerState.showStartProcessScreen && (
                            <>
                                <div className="op__center-align">
                                    <Button
                                        onClickAction={activateQRCodeUpload}
                                        text={t("register.button.orderballot")}
                                        type="primary"
                                    />
                                </div>
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
                                <ScanUploadQRCode
                                    headline={t("register.uploadqrcode.headline")}
                                    subheadline={t("register.uploadqrcode.subheadline")}
                                    uploadSubHeadline={t("register.uploadqrcode.uploadSubHeadline")}
                                    scanSubHeadline={t("register.uploadqrcode.scanSubHeadline")}
                                    onResult={(res) => updateUserKey(res)}
                                />
                            </>
                        )}

                        {registerState.showBallot && (
                            <>
                                {electionState === globalConst.electionState.ONGOING && (
                                    <>
                                        <div className="op__center-align">
                                            <Button
                                                onClickAction={goToElection}
                                                text={t("register.button.gotoelection.text")}
                                                type="secondary"
                                            />
                                        </div>
                                    </>
                                )}

                                <GenerateQRCode
                                    headline={t("register.generateqrcode.headline")}
                                    text={voting.registerCode}
                                    downloadHeadline={(t("register.generateqrcode.downloadHeadline")).toUpperCase()}
                                    downloadSubHeadline={voting.electionInformation.title}
                                    headimage="election-permit"
                                    saveButtonText={t("register.generateqrcode.savebuttontext")}
                                    pdfQRtype={globalConst.pdfType.ELECTIONPERMIT}
                                    qrCodeString={voting.registerCode}
                                    pdfInformation={{
                                        ELECTION_URL: Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation',
                                        STARTDATE: startDate,
                                        ENDDATE: endDate
                                    }}
                                    afterSaveFunction={() =>
                                        setRegisterState({
                                            ...registerState,
                                            showSaveRegisterQRSuccess: true
                                        })
                                    }
                                />

                                <div className="op__display_none_small op__display_none_wide">
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

                                <Popup
                                    showModal={registerState.showSaveRegisterQRSuccess}
                                    bodyText={t("register.popup.aftersave.text", { STARTDATE: startDate, ENDDATE: endDate })}
                                    headerText={t("register.popup.aftersave.headline")}
                                    buttonText={t("common.back")}
                                    buttonFunction={() => {
                                        window.scrollTo(0, 0);
                                        setRegisterState({
                                            ...registerState,
                                            showSaveRegisterQRSuccess: false
                                        });
                                    }}
                                    notificationType="success"
                                />

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
                                    shouldConfirm={false}
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
