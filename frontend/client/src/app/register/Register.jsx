'use client';

import { shallow } from "zustand/shallow";
import { useState, useEffect } from "react";
import { useRef } from 'react';

import NextImage from 'next/image';
import Notification from "../../components/Notification";
import Loading from "../../components/Loading";
import ConfirmPopup from "../../components/ConfirmPopup";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";
import GenerateQRCode from "../../components/GenerateQRCode";
import NavigationBox from "../../components/NavigationBox";
import Button from "../../components/Button";
import { useTranslation } from 'next-i18next';
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import Headline from "@/components/Headline";
import Modal from "@/components/Modal";
import { createPDF } from "@/save-pdf";
import AddToCalendar from '@/components/AddToCalendar';
import ErrorPopup from '@/components/ErrorPopup';
import {
    ElectionPermitAlreadyRegisteredError,
    VoterRegistrationError,
    VoterSessionExpiredError,
} from '@/errors';
import styles from '@/app/createsecret/styles/CreateSecret.module.css';
import { ArrowDownCircle } from 'lucide-react';

export default function Register() {
    const { t } = useTranslation();
    const user = useOpnVoteStore((state) => state.user);

    const { voting, updateUserKey, updatePage, updateVoting, updateNotification, notification, voteClient } = useOpnVoteStore(
        (state) => state, shallow
    );
    const [decodedValue, setDecodedValue] = useState("");
    const [electionState, setElectionState] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [registerCode, setRegisterCode] = useState("");
    const [showMod, setShowMod] = useState(false);
    const [registrationErrorDetails, setRegistrationErrorDetails] = useState(null);
    const [errorPopup, setErrorPopup] = useState(null);
    const election = voting.election;
    const electionTitle = voting.electionInformation.title;
    const electionTitleSanitized = electionTitle
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 20);

    const addToCalendarButtonRef = useRef(null);
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
        showCalendarLink: false,
        isBallotCheckSuccess: false,
        showBallotDownloads: true,
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
            if (voteClient && typeof voteClient.registerVoter === 'function') {
                let stringCredits = "";
                let response = "";
                let voterJwt = voting.jwt;
                let key = voteClient.importMasterKey(user.key);
                response = await voteClient?.registerVoter({ voterJwt, masterKey: key ?? undefined });
                if (!response.ok) {
                    throw new Error(response.error);
                }
                stringCredits = await voteClient?.exportCredentials(response.value);
                updateVoting({ registerCode: stringCredits, initElectionPermit: true });
                loadingQRchange();
            }
        } catch (error) {
            let buttonFunction;
            let buttonText;
            let errorNotificationText;
            let userError;

            switch (error.message) {
                case globalConst.ERROR.JWTAUTH:
                    buttonFunction = goToStart;
                    buttonText = t('register.error.jwtauthbuttontext');
                    errorNotificationText = t('register.error.jwtauth');
                    userError = new VoterSessionExpiredError();
                    break;
                case 'HTTP 400: {"data":null,"error":"Already registered"}': // this isn't nice.
                case globalConst.ERROR.ALREADYREGISTERED:
                    buttonFunction = activateQRCodeUpload;
                    buttonText = t('register.error.alreadyregisteredbuttontext');
                    errorNotificationText = t('register.error.alreadyregistered');
                    userError = new ElectionPermitAlreadyRegisteredError();
                    break;
                default:
                    buttonFunction = '';
                    buttonText = '';
                    errorNotificationText = t('register.error.general');
                    userError = new VoterRegistrationError();
            }

            setRegistrationErrorDetails({
                userError,
                location: 'register.errorpopup.headline',
                module: 'Register',
                block: 'generateVoteCredentials',
                technicalDetails: error instanceof Error
                    ? error.message || error.name
                    : t('errorpopup.technicaldetails.unavailable'),
            });

            setRegisterState({
                ...registerState,
                showLoading: false,
                showNotification: true,
                notificationText: errorNotificationText,
                notificationType: 'error',
                showCalendarLink: false,
                notificationButtonText: buttonText,
                notificationButtonAction: buttonFunction
            });
        };
    };

    // only loading animation
    const loadingQRchange = async function () {
        if (voting.initElectionPermit) {
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
        } else {
            setRegisterState({
                ...registerState,
                showElectionInformation: true,
                showQRCodeUploadPlugin: false,
                showBallot: true,
                showQRLoadingAnimation: false,
            });
        }
    };

    const goToStart = () => {
        window.location = voting.electionInformation.backLink + '?refreshElectionPermit=' + voting.electionId;
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
        updateUserKey('');
        updatePage({ current: globalConst.pages.LOADKEY });
    };

    const scrollToAddToCalendarButton = () => {
        setTimeout(() => {
            if (addToCalendarButtonRef.current) {
                addToCalendarButtonRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        }, 100);

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
            setErrorPopup(null);
            updateVoting({ registerCode: registerCode });
        }
    }, [registerCode]);

    useEffect(() => {

        const currentTime = Math.floor(new Date().getTime() / 1000);
        const tempStartTime = new Date(Number(voting.election.votingStartTime) * 1000);
        const tempEndTime = new Date(Number(voting.election.votingEndTime) * 1000);
        setStartDate(tempStartTime);
        setEndDate(tempEndTime);
        const state = Number(currentTime) < Number(voting.election.votingStartTime) ? globalConst.electionState.PLANNED : Number(currentTime) < Number(voting.election.votingEndTime) ? globalConst.electionState.ONGOING : globalConst.electionState.FINISHED;
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

    useEffect(() => {
        if (
            notification &&
            notification.targetPage === globalConst.pages.REGISTER &&
            notification.text
        ) {
            setRegisterState((prev) => ({
                ...prev,
                showNotification: true,
                notificationType: notification.type || 'success',
                notificationText: notification.text,
                showCalendarLink: Boolean(notification.showCalendarLink),
                isBallotCheckSuccess: Boolean(notification.isBallotCheckSuccess),
                showBallotDownloads: !notification.isBallotCheckSuccess,
            }));

            updateNotification({
                targetPage: '',
                type: '',
                text: '',
                show: false,
                showCalendarLink: false,
                isBallotCheckSuccess: false,
            });
        }
    }, [notification, updateNotification]);

    const shouldShowBallotCheckCalendarNotification =
        electionState === globalConst.electionState.PLANNED &&
        voting.registerCodeSaved;

    const hasBallotCheckCalendarNotifications =
        registerState.isBallotCheckSuccess &&
        shouldShowBallotCheckCalendarNotification;

    const shouldShowBallotDownloads =
        !registerState.isBallotCheckSuccess || registerState.showBallotDownloads;

    return (
        <>
            <Modal
                showModal={showMod}
                ctaButtonText={t("register.popup.aftersave.buttontext")}
                ctaButtonFunction={() => {
                    window.scrollTo(0, 0);
                    setShowMod(false);
                    updateVoting({ initElectionPermit: false });

                    updateVoting({ registerCodeSaved: true });
                    createPDF(
                        voting.registerCode,
                        (t("register.generateqrcode.downloadHeadline")).toUpperCase(),
                        voting.electionInformation.title,
                        t("register.generateqrcode.downloadFilename", {
                            ELECTIONTITLE: electionTitleSanitized,
                            CREATIONDATE: new Date().toISOString().split('T')[0]
                        }),
                        globalConst.pdfType.ELECTIONPERMIT,
                        {
                            ELECTION_URL: Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation',
                            STARTDATE: startDate,
                            ENDDATE: endDate
                        }
                    );


                }}
                onClose={() => setShowMod(false)}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Notification
                        type="success"
                        text={t("register.notification.aftersave.text")}
                    />
                    {electionState === globalConst.electionState.ONGOING &&
                        <div dangerouslySetInnerHTML={{ __html: t("register.popup.aftersave.infotext") }} />}

                    {electionState === globalConst.electionState.FINISHED && (
                        <div style={{ backgroundColor: '#efefef', borderRadius: '4px', padding: '10px' }}>
                            <div className="op__contentbox_max">
                                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    {t("pollingstation.electionHeader.statetitle.finished").toUpperCase()}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </Modal>

            <>
                <Headline
                    title={t("register.headline.title")}
                    text={t("register.headline.text")}
                    image="/images/online.svg"
                    progressBarStep={voting.registerCodeSaved ? globalConst.progressBarStep.readyToVote : globalConst.progressBarStep.saveBallot}
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
                            colorVariant={hasBallotCheckCalendarNotifications ? 'successDark' : undefined}
                            text={
                                <>
                                    {registerState.notificationText}{' '}
                                    {registerState.showCalendarLink && (
                                    <button
                                        type="button"
                                        onClick={scrollToAddToCalendarButton}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            padding: 0,
                                            cursor: 'pointer',
                                            verticalAlign: 'middle',
                                        }}
                                    >
                                        <ArrowDownCircle
                                            size={20}
                                            color="#0d6c7f"
                                        />
                                    </button>
                                    )}
                                </>
                            }
                            buttonText={registerState.notificationButtonText}
                            buttonAction={registerState.notificationButtonAction}
                            linkText={registerState.notificationType === 'error'
                                ? t('register.errorpopup.link')
                                : undefined}
                            linkAction={registerState.notificationType === 'error'
                                ? () => setErrorPopup(registrationErrorDetails)
                                : undefined}
                        />
                    </>
                )}

                {shouldShowBallotCheckCalendarNotification && (
                    <>
                        <Notification
                            type={'info'}
                            colorVariant={hasBallotCheckCalendarNotifications ? 'infoLight' : undefined}
                            additionalGlobalClass="op__margin_standard_top_bottom"
                            highlightLastHtmlParagraph
                            htmlText={t("showballot.votingstartfuture.info", { STARTDATE: startDate, ENDDATE: endDate, interpolation: { escapeValue: false } })}
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
                                <div className="op__center-align op__margin_standard_top_bottom">
                                    <Button
                                        onClick={activateQRCodeUpload}
                                        type="primary"
                                    >{t("register.button.orderballot")}</Button>
                                </div>
                                <div className="flex items-center justify-center">
                                    <div>
                                        <NavigationBox
                                            onClick={goToCreatesecret}
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
                                    insertAsTextSubHeadline={t("register.uploadqrcode.insertAsTextSubHeadline")}
                                    insertAsTextPlaceholder={t("register.uploadqrcode.insertAsTextPlaceholder")}
                                    insertAsTextHeadline={t("register.uploadqrcode.insertAsTextHeadline")}
                                    insertAsTextButton={t("register.uploadqrcode.insertAsTextButton")}
                                    onResult={(res) => updateUserKey(res)}
                                    qrContentType={globalConst.qrContentType.BALLOT}
                                />
                            </>
                        )}

                        {registerState.showBallot && (
                            <>
                                <div id="ballotDownloadOptions">
                                    {shouldShowBallotDownloads && (
                                        <>
                                            <GenerateQRCode
                                                headline={t("register.generateqrcode.headline")}
                                                text={voting.registerCode}
                                                downloadHeadline={(t("register.generateqrcode.downloadHeadline")).toUpperCase()}
                                                downloadSubHeadline={voting.electionInformation.title}
                                                downloadFilename={t("register.generateqrcode.downloadFilename", {
                                                    ELECTIONTITLE: electionTitleSanitized,
                                                    CREATIONDATE: new Date().toISOString().split('T')[0]
                                                })}
                                                headimage="election-permit-no-whitespace"
                                                pdfQRtype={globalConst.pdfType.ELECTIONPERMIT}
                                                qrCodeString={voting.registerCode}
                                                saved={voting.registerCodeSaved}
                                                savedAs={voting.registerCodeSavedAs}
                                                pdfInformation={{
                                                    ELECTION_URL: Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation',
                                                    STARTDATE: startDate,
                                                    ENDDATE: endDate
                                                }}
                                            afterSaveFunction={(type) => {
                                                let registerCodeSavedAsLocal = voting.registerCodeSavedAs;
                                                    if (!registerCodeSavedAsLocal.includes(type)) {
                                                        registerCodeSavedAsLocal.push(type);
                                                    }
                                                    updateVoting({ initElectionPermit: false });
                                                    setRegisterState({
                                                        ...registerState,
                                                        showSaveRegisterQRSuccess: true
                                                    });
                                                    updateVoting({
                                                        registerCodeSaved: true,
                                                        registerCodeSavedAs: registerCodeSavedAsLocal
                                                    });
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                                <div>
                                    <p dangerouslySetInnerHTML={{
                                        __html: t('register.popup.aftersave.text', {
                                            STARTDATE: startDate,
                                            ENDDATE: endDate,
                                            ELECTIONTITLE: electionTitle,
                                        }),
                                    }} ></p>
                                </div>
                                <div style={{ margin: 'auto', maxWidth: '340px' }}>
                                    <AddToCalendar
                                        electionURL={Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation'}
                                        electionId={voting.electionId}
                                        eventDate={startDate}
                                        eventTitle={t('register.popup.aftersave.addToCalendar.title', {
                                            ELECTIONTITLE: electionTitle,
                                        })}
                                        electionTitleSanitized={electionTitleSanitized}
                                        eventDescription={t('register.popup.aftersave.addToCalendar.description', {
                                            STARTDATE: startDate,
                                            ENDDATE: endDate,
                                            ELECTIONTITLE: electionTitle,
                                            ELECTIONURL: Config.env.basicUrl + '/?id=' + voting.electionId + '#pollingstation',
                                        })}
                                        buttonRef={addToCalendarButtonRef}
                                    />

                                    {registerState.isBallotCheckSuccess && (
                                        <div className="op__margin_standard_top">
                                            <Button
                                                type="secondary"
                                                stretched
                                                aria-expanded={registerState.showBallotDownloads}
                                                aria-controls="ballotDownloadOptions"
                                                onClick={() => setRegisterState((prev) => ({
                                                    ...prev,
                                                    showBallotDownloads: !prev.showBallotDownloads,
                                                }))}
                                            >
                                                {t(registerState.showBallotDownloads
                                                    ? 'register.generateqrcode.hidedownloadoptions'
                                                    : 'register.generateqrcode.showdownloadoptions')}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="op__display_none_small op__display_none_wide">
                                    <Button
                                        onClick={() =>
                                            setRegisterState({
                                                ...registerState,
                                                showContinueModal: true,
                                            })}
                                        type="primary"
                                    >{t('register.button.votelater.text')}</Button>
                                </div>
                                {electionState === globalConst.electionState.ONGOING && (
                                    <>
                                        <div className="op__center-align op__margin_standard_20_top_bottom">
                                            <Button
                                                onClick={goToElection}
                                                type="secondary"
                                            >{t('register.button.gotoelection.text')}</Button>
                                        </div>
                                    </>
                                )}

                                <Modal
                                    showModal={registerState.showSaveRegisterQRSuccess}
                                    headerText={t("register.popup.aftersave.headline")}
                                    ctaButtonText={electionState !== globalConst.electionState.ONGOING ? t("common.gotooverview") : ''}
                                    ctaButtonFunction={() => {
                                        setRegisterState({
                                            ...registerState,
                                            showSaveRegisterQRSuccess: false
                                        });
                                        if (electionState !== globalConst.electionState.ONGOING) {
                                            updatePage({ current: globalConst.pages.OVERVIEW });
                                        }
                                    }}
                                    onClose={() => setRegisterState({
                                        ...registerState,
                                        showSaveRegisterQRSuccess: false
                                    })}
                                >

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <Notification
                                            type="success"
                                            text={t('register.popup.aftersave.notification')}
                                        />
                                    </div>

                                    <div className={'op__margin_standard_20_top'}>
                                        <p>{t("register.popup.aftersave.checkballotpaper")}
                                            <a className={styles.link}
                                                onClick={() => updatePage({ current: globalConst.pages.CHECKLOADBALLOT })}
                                            >{t("register.popup.aftersave.checkballotpaperLinktext")}</a>
                                        </p>
                                    </div>

                                </Modal>

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

                        <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
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

                        <div className="op__margin_standard_20_top_bottom">
                            <Button
                                onClick={goToElection}
                                type="secondary"
                            >{t("register.button.gotoelection.text")}</Button>
                        </div>
                    </>
                )}
            </div>
            <ErrorPopup error={errorPopup} onClose={() => setErrorPopup(null)} />
        </>
    );
}
