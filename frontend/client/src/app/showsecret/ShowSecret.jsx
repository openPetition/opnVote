'use client';
import { useEffect, useState } from "react";
import GenerateQRCode from "../../components/GenerateQRCode";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import { ArrowRightIcon } from "lucide-react";
import globalConst from "@/constants";
import Button from '@/components/Button';
import Notification from "@/components/Notification";

export default function ShowSecret() {
    const { t } = useTranslation();
    const { user, updatePage, updateUser, notification, updateNotification } = useOpnVoteStore((state) => state);
    const [pageNotification, setPageNotification] = useState(notification)

    const goToRegister = () => {
        updatePage({ current: globalConst.pages.REGISTER });
    };

    useEffect(() => {
        // 2. Wenn der globale State true war, setzen wir ihn im Hintergrund sofort zurück
        if (notification && notification.targetPage === globalConst.pages.SHOWKEY) {
            updateNotification({
                targetPage: '',
                type: '',
                text: ''
            })
        }
    }, [notification]);

    return (
        <>
            <div>
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    progressBarStep={user.keySaved ? globalConst.progressBarStep.savedKey : globalConst.progressBarStep.saveKey}
                />
            </div>
            <main className="op__contentbox_760">
                <>
                    {pageNotification.targetPage === globalConst.pages.SHOWKEY && (
                        <Notification
                            type={pageNotification.type}
                            text={pageNotification.text}
                        />
                    )}
                    <GenerateQRCode
                        headline={t("secret.generateqrcode.headline")}
                        text={user.key}
                        downloadHeadline={(t("secret.generateqrcode.downloadHeadline")).toUpperCase()}
                        downloadFilename={t("secret.generateqrcode.downloadFilename", { CREATIONDATE: new Date().toISOString().split('T')[0] })}
                        headimage="key-no-whitespace"
                        saved={user.keySaved}
                        savedAs={user.keySavedAs}
                        qrCodeString={user.key}
                        pdfQRtype={globalConst.pdfType.VOTINGKEY}
                        afterSaveFunction={(type) => {
                            let localKeySavedAs = user.keySavedAs;
                            !localKeySavedAs.includes(type) && localKeySavedAs.push(type);
                            updateUser(
                                {
                                    keySaved: true,
                                    keySavedAs: localKeySavedAs
                                }
                            );
                        }}

                    />

                    <Button
                        onClick={() => goToRegister()}
                        disabled={!user.keySaved}
                        type="primary_dark"
                        style={{ display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'flex-end', margin: '0 auto' }}
                    >
                        {t("secret.navigationbox.gotoregister.aftergenerated.buttonText")}
                        <div style={{ alignSelf: 'center' }}>
                            {
                                (!user.keySaved)
                                    ?
                                    <ArrowRightIcon stroke={'#c9c8c8'} strokeWidth={'3'} width={20} />
                                    :
                                    <ArrowRightIcon stroke={'white'} strokeWidth={'3'} width={20} />
                            }
                        </div>
                    </Button>
                </>
            </main>
        </>
    );
}
