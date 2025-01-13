'use client';
import { useEffect, useState } from "react";
import { useTranslation } from 'next-i18next';
import { useOpnVoteStore } from "../../../opnVoteStore";
import HtmlQRCodePlugin from "@/components/ScanUploadQRCode";
import Popup from "@/components/Popup";
import Notification from "@/components/Notification";

export default function Keycheck() {
    const { t } = useTranslation();
    const [decodedValue, setDecodedValue] = useState("");
    const { user, voting } = useOpnVoteStore((state) => state);

    const [keyCheckState, setKeyCheckState] = useState({
        showNotification: false,
        showConfirmPopup: false
    });

    useEffect(() => {
        // work with qr code value / decoded value in next step
        if (decodedValue && decodedValue.length > 0) {
            if (user.key === decodedValue) {
                setKeyCheckState({
                    ...keyCheckState,
                    showConfirmPopup: true
                });
            } else {
                setKeyCheckState({
                    ...keyCheckState,
                    showNotification: true,
                    notificationText: t("keycheck.error"),
                    notificationType: 'error'
                });
            }
        }
    }, [decodedValue]);

    return (
        <>
            {keyCheckState.showNotification && (
                <>
                    <Notification
                        type={keyCheckState.notificationType}
                        text={keyCheckState.notificationText}
                    />
                </>
            )}

            <HtmlQRCodePlugin
                headline={t("register.uploadqrcode.headline")}
                subheadline={t("register.uploadqrcode.subheadline")}
                uploadSubHeadline={t("register.uploadqrcode.uploadSubHeadline")}
                scanSubHeadline={t("register.uploadqrcode.scanSubHeadline")}
                onResult={(res) => setDecodedValue(res)}
            />

            <Popup
                showModal={keyCheckState.showConfirmPopup}
                bodyText={t("keycheck.popup.text")}
                headerText={t("keycheck.popup.header")}
                buttonText={t("keycheck.popup.button")}
                buttonFunction={() => {
                    window.location.href = "/register?id=" + voting.electionId + '&jwt=' + voting.jwt;
                }}
                notificationType="success"
            />
        </>
    );
}
