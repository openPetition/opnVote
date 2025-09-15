'use client';

import { useState, useEffect } from "react";
import HtmlQRCodePlugin from "@/components/ScanUploadQRCode";
import Headline from "@/components/Headline";
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import NextImage from "next/image";
import Modal from "@/components/Modal";
import { checkBallot } from "@/util";
import Notification from "@/components/Notification";

export default function LoadBallot() {
    const { updatePage, voting, updateVoting } = useOpnVoteStore((state) => state);
    const [uploadedBallotCode, setUploadedBallotCode] = useState('');
    const [error, setError] = useState(null);
    const { t } = useTranslation();

    const qrCodeToCredentials = (code) => {
        const result = checkBallot(voting.election, code);
        if (result.result === 'success') {
            updateVoting({ registerCode: result.registerCode });
            updatePage({ current: globalConst.pages.POLLINGSTATION });
        } else {
            setError(result.error);
        }
        setUploadedBallotCode('');
    };

    useEffect(() => {
        if (uploadedBallotCode.length === 0) {
            return;
        }

        qrCodeToCredentials(uploadedBallotCode);
    }, [uploadedBallotCode]);

    return (
        <>
            {error && (
                <Modal
                    showModal={error}
                    headerText={t(error.title)}
                    ctaButtonText={t(error.button)}
                    ctaButtonFunction={() => setError(null)}
                >
                    <Notification
                        type="error"
                        text={t(error.text)}
                    />
                </Modal>
            )}
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("loadballot.upload.title")}
                    progressBarStep={globalConst.progressBarStep.vote}
                />
            </div>
            <main className="op__contentbox_760">

                <HtmlQRCodePlugin
                    headline={t("pollingstation.uploadqrcode.headline")}
                    subheadline={t("pollingstation.uploadqrcode.subheadline")}
                    uploadSubHeadline={t("pollingstation.uploadqrcode.uploadSubHeadline")}
                    scanSubHeadline={t("pollingstation.uploadqrcode.scanSubHeadline")}
                    onResult={(res) => {
                        setUploadedBallotCode(res);
                    }}
                />
            </main>
        </>
    );
}
