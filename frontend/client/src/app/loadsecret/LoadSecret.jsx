'use client';
import { useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import globalConst from "@/constants";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";
import Button from "@/components/Button";

export default function LoadSecret() {
    const { t } = useTranslation();

    const { user, updateUserKey, updatePage } = useOpnVoteStore((state) => state);

    useEffect(() => {
        if (user?.key?.length > 0) {
            updatePage({ current: globalConst.pages.SHOWKEY }, modes.replace);
        }
    }, [user]);

    return (
        <>
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
                    <Button
                        onClick={() => { updatePage({ current: globalConst.pages.CREATEKEY }); }}
                        type="primary"
                    >{t("loadsecret.backToSecretCreation")}</Button>
                </>
            </main>
        </>
    );
}
