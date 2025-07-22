'use client';
import { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";
import Notification from "../../components/Notification";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import btn_styles from "@/styles/Button.module.css";
import { ArrowRightIcon } from "lucide-react";
import Modal from '@/components/Modal';
import globalConst from "@/constants";
import navigationbox_styles from "@/styles/NavigationBox.module.css";
import NextImage from "next/image";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";

export default function LoadSecret() {
    const [showMod, setShowMod] = useState(false);
    const { t } = useTranslation();

    const { user, voting, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

    useEffect(() => {
        if (user?.key?.length > 0) {
            updatePage({ current: globalConst.pages.SHOWKEY });
        }
    }, [user]);


    return (
        <>
            <title>{t("secret.title")}</title>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    progressBarStep={globalConst.progressBarStep.key}
                />
            </div>
            <main className="op__contentbox_760">
                <>
                    <ScanUploadQRCode
                        headline={t("register.uploadqrcode.headline")}
                        subheadline={t("register.uploadqrcode.subheadline")}
                        uploadSubHeadline={t("register.uploadqrcode.uploadSubHeadline")}
                        scanSubHeadline={t("register.uploadqrcode.scanSubHeadline")}
                        onResult={(res) => updateUserKey(res, true)}
                    />
                    <button
                        onClick={() => { updatePage({ current: globalConst.pages.CREATEKEY }); }}
                        className={`${btn_styles.secondary} ${btn_styles.btn}`}
                    >
                        {t("keycheck.backToSecretCreation")}
                    </button>
                </>

            </main>
        </>
    );
}
