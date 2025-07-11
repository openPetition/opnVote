'use client';

import { useState, useEffect } from "react";
import { useTranslation } from 'next-i18next';

import Overview from "@/app/overview/Overview";
import CreateSecret from "@/app/createsecret/CreateSecret";
import Pollingstation from "@/app/pollingstation/Pollingstation";
import Register from "@/app/register/Register";
import VoteTransaction from "@/app/votetransaction/VoteTransaction";
import { useOpnVoteStore } from "@/opnVoteStore";
import Loading from "@/components/Loading";
import Button from "@/components/Button";
import Notification from "@/components/Notification";
import globalConst from "@/constants";
import Faq from "@/app/faq/Faq";

export default function Home() {
    const { t } = useTranslation();
    const { page } = useOpnVoteStore((state) => state);

    const ErrorReturn = () => {
        return (
            <div className="op__contentbox_760">
                <Notification
                    type="error"
                    text={t("common.apploadfailed")}
                />
                <Button
                    text={t("common.back")}
                    type="primary"
                    onClickAction={() => { history.back(); }} // we might dont know anything else here if no data / election loaded
                />
            </div>
        );
    }

    const HydrationZustand = ({ children }) => {
        const [isPageHydrated, setIsPageHydrated] = useState(false);

        useEffect(() => {
            setIsPageHydrated(true);
        }, []);

        return <>
            {isPageHydrated && (
                <div>{children}</div>
            ) || <Loading loadingText={'loading'} />}
        </>;
    }

    return (
        <>
            <HydrationZustand>
                <>
                    {page.current == globalConst.pages.LOADING && (
                        <Loading loadingText={t("common.apploading")} />
                    ) || page.current == globalConst.pages.OVERVIEW && (
                        <Overview />
                    ) || page.current == globalConst.pages.REGISTER && (
                        <Register />
                    ) || page.current == globalConst.pages.POLLINGSTATION && (
                        <Pollingstation />
                    ) || page.current == globalConst.pages.CREATEKEY && (
                        <CreateSecret />
                    ) || page.current == globalConst.pages.VOTETRANSACTION && (
                        <VoteTransaction />
                    ) || page.current == globalConst.pages.FAQ && (
                        <Faq />
                    ) || page.current == globalConst.pages.ERROR && (
                        <ErrorReturn />
                    )}
                </>
            </HydrationZustand >
        </>
    );
}
