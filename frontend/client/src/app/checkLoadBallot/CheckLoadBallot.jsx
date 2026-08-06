'use client';

import { useState, useEffect } from "react";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";
import Headline from "@/components/Headline";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "../../opnVoteStore";
import globalConst from "@/constants";
import Modal from "@/components/Modal";
import { checkBallot } from "@/util";
import Notification from "@/components/Notification";

export default function CheckLoadBallot() {
    const { updatePage, voting, updateNotification } = useOpnVoteStore((state) => state);
    const [uploadedBallotCode, setUploadedBallotCode] = useState('');
    const [error, setError] = useState(null);
    const { t } = useTranslation();

    const qrCodeToCredentials = (code) => {
        const result = checkBallot(voting.election, code);
        if (result.result === 'success') {
            updateNotification({
                targetPage: globalConst.pages.REGISTER,
                type: 'success',
                text: t('checkloadballot.notification.success.text'),
                show: true,
                showCalendarLink: true,
            });
            updatePage({ current: globalConst.pages.REGISTER });
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
                    onClose={() => setError(null)}
                >
                    <Notification
                        type="error"
                        text={t(error.text)}
                    />
                </Modal>
            )}
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("checkloadballot.upload.title")}
                />
            </div>
            <main className="op__contentbox_760">

                <ScanUploadQRCode
                    headline={t("checkloadballot.uploadcomponent.headline")}
                    subheadline={t("checkloadballot.uploadcomponent.subheadline")}
                    uploadSubHeadline={t("pollingstation.uploadqrcode.uploadSubHeadline")}
                    scanSubHeadline={t("pollingstation.uploadqrcode.scanSubHeadline")}
                    insertAsTextSubHeadline={t("pollingstation.uploadqrcode.insertAsTextSubHeadline")}
                    insertAsTextPlaceholder={t("pollingstation.uploadqrcode.insertAsTextPlaceholder")}
                    insertAsTextHeadline={t("pollingstation.uploadqrcode.insertAsTextHeadline")}
                    insertAsTextButton={t("pollingstation.uploadqrcode.insertAsTextButton")}
                    uploadHeadline={t("pollingstation.uploadheadline.ballot")}
                    onResult={(res) => {
                        setUploadedBallotCode(res);
                    }}
                    qrContentType={globalConst.qrContentType.BALLOT}
                />
            </main>
        </>
    );
}
