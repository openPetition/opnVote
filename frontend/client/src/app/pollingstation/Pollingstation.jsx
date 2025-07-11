'use client';

import { useState, useEffect } from "react";
import Notification from "@/components/Notification";
import Button from '@/components/Button';
import HtmlQRCodePlugin from "@/components/ScanUploadQRCode";
import Electionheader from "./components/Electionheader";
import Question from "./components/Question";
import { getVoteCastsData } from '../../service-graphql';
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { sendVotes } from "./sendVotes";
import { useTranslation } from 'next-i18next';
import Config from "../../../next.config.mjs";
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import qr_styles from "@/styles/ScanUploadQRCode.module.css";
import navigationbox_styles from "@/styles/NavigationBox.module.css";
import NextImage from "next/image";
import Modal from "@/components/Modal";

export default function Pollingstation() {
    const { updatePage, voting, updateVoting, updateTaskId, taskId } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const [votingCredentials, setVotingCredentials] = useState({});
    const [votes, setVotes] = useState({});
    const [getVoteCasts, { data: dataVotings, loading: loadingVotings }] = getVoteCastsData(votingCredentials?.voterWallet?.address, voting.election.id);

    // manages what to show and how far we came incl. noticiation cause they also can cause some change in view.
    const [pollingStationState, setPollingStationState] = useState({
        taskId: '',
        showElectionInformation: true,
        showElection: false,
        showVotingSlipUpload: false,
        showVotingSlipSelection: true,
        showNotification: false,
        showQuestions: true,
        showSendError: false,
        pending: false,
        allowedToVote: false,
        notificationText: '',
        notificationType: '',
        isVoteRecast: false
    });

    function ctaButtonState(pollingStationState) {
        const newState = {
            ...pollingStationState,
            showNotification: false,
        };

        if (pollingStationState.notificationType === 'error' && pollingStationState.showVotingSlipUpload === false || pollingStationState.showVotingSlipSelection === true) {
            return {
                ...newState,
                showNotification: false,
                showVotingSlipUpload: true,
                showVotingSlipSelection: false,
                showQuestions: false,
            };
        }
        return newState;
    };
    const saveVotes = async () => {
        setPollingStationState({ ...pollingStationState, pending: true });
        //result will be changed still ! we have to work with result (error notes.. redirect or sth else..)
        try {
            const taskId = await sendVotes(votes, votingCredentials, voting.election.publicKey, pollingStationState.isVoteRecast);
            if (taskId) {
                updateTaskId(taskId);
            }
        } catch (e) {
            setPollingStationState({
                ...pollingStationState,
                showSendError: t('pollingstation.button.errormessage'),
                allowedToVote: true,
                pending: true,
            });
            setTimeout(() => {
                setPollingStationState({ ...pollingStationState, pending: false });
            }, 10000);
        }
    };

    const qrCodeToCredentials = async (code) => {
        try {
            let credentials = await qrToElectionCredentials(code);
            if (Object.keys(credentials).length > 0) {
                await validateCredentials(credentials);
                if (parseInt(credentials?.electionID) !== parseInt(voting?.election?.id)) {
                    setPollingStationState({
                        ...pollingStationState,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: false,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: true,
                        allowedToVote: false,
                        showNotification: true,
                        notificationText: t("pollingstation.notification.error.ballotnotfitting"),
                        notificationType: 'error',
                        popupButtonText: t("pollingstation.notification.error.ballotnotfitting.popup.buttontext"),
                        popupHeadline: t("pollingstation.notification.error.ballotnotfitting.popup.headline"),
                    });
                } else {
                    setVotingCredentials(credentials);
                    setPollingStationState({
                        ...pollingStationState,
                        showElectionInformation: true,
                        showQuestions: true,
                        showElection: true,
                        showVotingSlipUpload: false,
                        showVotingSlipSelection: false
                    });
                }
            }
        } catch (err) {
            setPollingStationState({
                ...pollingStationState,
                showElection: false,
                showQuestions: true,
                showVotingSlipUpload: false,
                showVotingSlipSelection: true,
                showNotification: true,
                notificationText: t("pollingstation.notification.error.ballotdatacorrupt"),
                notificationType: 'error',
                popupButtonText: t("pollingstation.notification.error.ballotdatacorrupt.popup.buttontext"),
                popupHeadline: t("pollingstation.notification.error.ballotdatacorrupt.popup.headline"),
            });
        }
    };

    useEffect(() => {
        if (loadingVotings || !dataVotings) return;

        if (dataVotings && dataVotings?.voteUpdateds && Object.keys(dataVotings?.voteUpdateds).length >= Config.env.maxVoteRecasts) {
            setPollingStationState({
                ...pollingStationState,
                allowedToVote: false,
                showNotification: true,
                notificationText: t("pollingstation.notification.error.novotechange"),
                notificationType: 'error',
                showVotingSlipUpload: false,
                showVotingSlipSelection: false,
                popupButtonText: t("pollingstation.notification.error.novotechange.popup.buttontext"),
                popupHeadline: t("pollingstation.notification.error.novotechange.popup.headline"),
            });
            return;
        }

        let isVoteRecast = false;
        // after we got voteCasts data .. check this
        if (dataVotings && dataVotings?.voteCasts && Object.keys(dataVotings?.voteCasts).length > 0) {
            isVoteRecast = true;
        }

        setPollingStationState({
            ...pollingStationState,
            allowedToVote: true,
            isVoteRecast: isVoteRecast,
            showQuestions: true,
            showNotification: true,
            notificationType: 'success',
            notificationText: t("pollingstation.notification.success.ballotfits"),
            popupButtonText: t("pollingstation.notification.success.popup.buttontext"),
            popupHeadline: t("pollingstation.notification.success.popup.headline"),
        });
    }, [dataVotings]);

    useEffect(() => {

        if (taskId && taskId.length > 0) {
            updateVoting({ votesuccess: false, transactionViewUrl: '' }); //invalidate
            updatePage({ current: globalConst.pages.VOTETRANSACTION });
        };

        // only if we have the electioninformations its worth to check
        // wether there is some voter informations stored.
        if (voting.registerCode?.length == 0 || Object.keys(voting.electionInformation).length === 0 || voting.electionInformation.constructor !== Object) {
            return;
        }

        qrCodeToCredentials(voting.registerCode);
    }, []);

    useEffect(() => {
        // here we have to see wether voter already voted to prepare for vote-recast
        if (Object.keys(votingCredentials).length > 0 && voting.election.id && Object.keys(voting.electionInformation).length > 0) {
            getVoteCasts();
        }
    }, [votingCredentials]);

    return (
        <>
            <Modal
                showModal={pollingStationState.showNotification}
                headerText={pollingStationState.popupHeadline}
                ctaButtonText={pollingStationState.popupButtonText}
                ctaButtonFunction={() => setPollingStationState(ctaButtonState(pollingStationState))}
            >
                <Notification
                    type={pollingStationState.notificationType}
                    text={pollingStationState.notificationText}
                />
            </Modal>
            <title>{t("pollingstation.title")}</title>
            {(voting.registerCode || pollingStationState.allowedToVote) &&
                (pollingStationState.showElectionInformation && (
                    <Electionheader
                        election={voting?.election}
                        electionInformation={voting.electionInformation}
                    />
                ))
            }

            {pollingStationState.showVotingSlipSelection && (
                <div className="op__contentbox_760">
                    <div className="op__padding_standard_top_bottom">
                        <h4>{t("pollingstation.headline.ballotneeded")}</h4>
                        <p className="op__center-align">{t("pollingstation.uploadqrcode.subheadline")}</p>
                    </div>
                    <div className="op__contentbox_760" style={{ scrollMarginTop: "60px" }}>
                        <div className="flex op__gap_10_small op__gap_30_wide op__flex_direction_row_wide op__flex_direction_column_small">
                            <div className="op__outerbox_grey go_to_upload op__flex_grow_standard op__width_100 op__flex_center_align op__flex"
                                onClick={(e) =>
                                    setPollingStationState({
                                        ...pollingStationState,
                                        showVotingSlipUpload: true,
                                        showVotingSlipSelection: false,
                                        showQuestions: false,
                                        showNotification: false,
                                    })}>
                                <div className={`${navigationbox_styles.innerbox} op__width_100`} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                                    <div className="flex op__gap_30" >
                                        <div className={qr_styles.qrbg}>
                                            <NextImage
                                                priority
                                                src="/images/load-picture.svg"
                                                height={60}
                                                width={60}
                                                alt=""
                                            />
                                        </div>
                                        <div>
                                            <h3>{t('scanuploadqrcode.button.pdf.headline')}</h3>
                                            <p>{t('scanuploadqrcode.button.pdf.subheadline')}</p>
                                        </div>

                                    </div>
                                </div>
                            </div>
                            <div className="op__outerbox_grey go_to_upload op__flex_grow_standard op__width_100 op__flex_center_align op__flex"
                                onClick={() =>
                                    setPollingStationState({
                                        ...pollingStationState,
                                        showVotingSlipUpload: true,
                                        showVotingSlipSelection: false,
                                        showQuestions: false,
                                        showNotification: false,
                                    })}>
                                <div className={`${navigationbox_styles.innerbox} op__width_100`} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                                    <div className="flex op__gap_30">
                                        <div className={qr_styles.qrbg}>
                                            <NextImage
                                                priority
                                                src="/images/scan-qrcode.svg"
                                                height={60}
                                                width={60}
                                                alt=""
                                            />
                                        </div>
                                        <div>
                                            <h3>{t('scanuploadqrcode.button.camera.headline')}</h3>
                                            <p>{t('scanuploadqrcode.button.camera.subheadline')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {(voting.registerCode || pollingStationState.allowedToVote) &&
                <div className={`${pollingStationState.allowedToVote ? 'op__contentbox_max' : 'op__contentbox_760'}`}>
                    {pollingStationState.showQuestions && (
                        <>
                            {voting.electionInformation.questions.map((question, index) =>
                                <Question
                                    key={index}
                                    imageUrl={question.imageUrl}
                                    questionKey={index}
                                    question={question.text}
                                    selectedVote={votes[index]}
                                    showVoteOptions={pollingStationState.allowedToVote}
                                    setVote={(selection) => setVotes(votes => ({
                                        ...votes,
                                        [index]: selection
                                    }))}
                                />
                            )}
                        </>
                    )}
                </div>
            }

            <div className="op__contentbox_760 op__center-align">
                {pollingStationState.showVotingSlipUpload && (
                    <div className="op__margin_2_top">
                        <HtmlQRCodePlugin
                            headline={t("pollingstation.uploadqrcode.headline")}
                            subheadline={t("pollingstation.uploadqrcode.subheadline")}
                            uploadSubHeadline={t("pollingstation.uploadqrcode.uploadSubHeadline")}
                            scanSubHeadline={t("pollingstation.uploadqrcode.scanSubHeadline")}
                            onResult={(res) => {
                                qrCodeToCredentials(res);
                            }}
                        />

                        <div className="op__center_align">
                            <Button
                                onClickAction={() =>
                                    setPollingStationState({
                                        ...pollingStationState,
                                        showVotingSlipUpload: false,
                                        showQuestions: true,
                                        showVotingSlipSelection: true,
                                    })
                                }
                                text={t("pollingstation.button.cancel")}
                                type="primary"
                            />
                        </div>

                    </div>
                )}
                {pollingStationState.showElection && pollingStationState.allowedToVote && (
                    <>
                        <div className="op__center-align">
                            <Button
                                onClickAction={saveVotes}
                                isDisabled={pollingStationState.pending}
                                text={t("pollingstation.button.savevotes")}
                                type="primary"
                                id="test_btn_sendvote"
                            />
                        </div>
                        {pollingStationState.showSendError && (
                            <Notification type="error" text={pollingStationState.showSendError} />
                        )}
                    </>
                )}
            </div>
        </>
    );
}
