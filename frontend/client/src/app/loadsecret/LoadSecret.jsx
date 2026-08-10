'use client';
import { useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore, modes } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import globalConst from "@/constants";
import ScanUploadQRCode from "@/components/ScanUploadQRCode";
import Button from "@/components/Button";
import { ArrowLeft } from "lucide-react";

export default function LoadSecret() {
    const { t } = useTranslation();

    const { user, updateUser, updatePage, updateNotification } = useOpnVoteStore((state) => state);

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
                    progressBarStep={globalConst.progressBarStep.saveKey}
                />
            </div>
            <main className="op__contentbox_760">
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
                        qrContentType={globalConst.qrContentType.KEY}
                        onResult={(code, savedAs) => {
                            let localKeySavedAs = user.keySavedAs;
                            !localKeySavedAs.includes(savedAs) && localKeySavedAs.push(savedAs);
                            updateNotification({
                                targetPage: globalConst.pages.SHOWKEY,
                                type: 'success',
                                text: t("loadsecret.upload.success")
                            })
                            updateUser({
                                key: code,
                                keySaved: true,
                                keySavedAs: savedAs
                            })
                        }}
                    />
					<div className="op__flex op__flex_direction_column_small op__flex_direction_row_wide op__flex_center_align op__mob_padding_standard_left_right op__padding_standard_bottom">
						<Button
							type="primary"
							onClick={() => updatePage({ current: globalConst.pages.CREATEKEY })}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "10px"
							}}
						>
							<ArrowLeft color="#fff" size={20} strokeWidth={3} />
							{t("loadsecret.backToSecretCreation")}
						</Button>
					</div>
                </>
            </main>
        </>
    );
}
