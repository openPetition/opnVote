'use client';
import GenerateQRCode from "../../components/GenerateQRCode";
import { useTranslation } from "next-i18next";
import { useOpnVoteStore } from "../../opnVoteStore";
import Headline from "@/components/Headline";
import { ArrowRightIcon } from "lucide-react";
import globalConst from "@/constants";
import Button from '@/components/Button';

export default function ShowSecret() {
    const { t } = useTranslation();
    const { user, updatePage, updateUser } = useOpnVoteStore((state) => state);

    const goToRegister = () => {
        updatePage({ current: globalConst.pages.REGISTER });
    };
    console.log(user);
    const afterSaveFunction = (type) => {
        let keySavedAs = user.keySavedAs;
        console.log('savefunction save as: ' + type);
        keySavedAs = !keySavedAs?.includes(type) ? keySavedAs.push(type) : keySavedAs;
        updateUser(
            {
                keySaved: true,
                keySavedAs: keySavedAs
            });
    }

    return (
        <>
            <div>
                <Headline
                    title={t("secret.headline.createSecret.title")}
                    text={t("secret.headline.createSecret.text")}
                    progressBarStep={globalConst.progressBarStep.key}
                />
            </div>
            <main className="op__contentbox_760">
                <>
                    <GenerateQRCode
                        headline={t("secret.generateqrcode.headline")}
                        text={user.key}
                        downloadHeadline={(t("secret.generateqrcode.downloadHeadline")).toUpperCase()}
                        downloadFilename={t("secret.generateqrcode.downloadFilename", { CREATIONDATE: new Date().toISOString().split('T')[0] })}
                        headimage="key-no-whitespace"
                        saveButtonText={user.keySaved ? t("secret.generateqrcode.saveagainbuttontext") : t("secret.generateqrcode.savebuttontext")}
                        saved={user.keySaved}
                        savedAs={user.keySavedAs}
                        qrCodeString={user.key}
                        pdfQRtype={globalConst.pdfType.VOTINGKEY}
                        afterSaveFunction={afterSaveFunction}

                    />

                    <Button
                        onClick={() => goToRegister()}
                        disabled={!user.keySaved}
                        type="primary"
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
