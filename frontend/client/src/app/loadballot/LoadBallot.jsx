'use client';

import { useState, useEffect } from "react";
import Notification from "@/components/Notification";
import Button from '@/components/Button';
import HtmlQRCodePlugin from "@/components/ScanUploadQRCode";
import Headline from "@/components/Headline";
import { qrToElectionCredentials, validateCredentials } from "votingsystem";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import NextImage from "next/image";
import Modal from "@/components/Modal";

export default function LoadBallot() {
    const { updatePage, voting, updateVoting } = useOpnVoteStore((state) => state);
    const [uploadedBallotCode, setUploadedBallotCode] = useState('');
    const { t } = useTranslation();

    const qrCodeToCredentials = async (code) => {
        let credentials = await qrToElectionCredentials(code);
        if (Object.keys(credentials).length > 0) {
            await validateCredentials(credentials);
            if (voting?.election?.id && (parseInt(credentials?.electionID) === parseInt(voting?.election?.id))) {
                updateVoting({ registerCode: code });
                updatePage({ current: globalConst.pages.POLLINGSTATION });
            } else {
                // TODO Case: no election id given 
            }
        }
    };

    useEffect(() => {
        if (uploadedBallotCode.length === 0) {
            return;
        }

        qrCodeToCredentials(uploadedBallotCode);
    }, [uploadedBallotCode]);

    return (
        <>
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
    )
}