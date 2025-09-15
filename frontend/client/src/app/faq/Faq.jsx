import { useTranslation, Trans } from "next-i18next";
import Headline from "@/components/Headline";
import Accordeon from "@/components/Accordeon";
import Button from "@/components/Button";
import Link from 'next/link';
import { useOpnVoteStore } from '@/opnVoteStore';

export default function Faq() {
    const { clear } = useOpnVoteStore((state) => state);

    const { t } = useTranslation();

    const faqContent = {
        getstarted: {
            title: t("faq.content.getstarted.title"),
            text: <Trans i18nKey="faq.content.getstarted.text"
                components={{ Openlink: <Link href="https://www.openpetition.de/opn-vote" /> }}
            />,
        },
        process: {
            title: t("faq.content.process.title"),
            text: <Trans i18nKey="faq.content.process.text"
                components={{ Linkelectionbasics: <Link href="https://www.bundestag.de/parlament/bundestagswahl/wahlrechtsgrundsaetze-1021218" /> }}
            />,
        },
        participation: {
            title: t("faq.content.participation.title"),
            text: <Trans i18nKey="faq.content.participation.text"
                components={{ Linkelectionbasics: <Link href="https://www.bundestag.de/parlament/bundestagswahl/wahlrechtsgrundsaetze-1021218" /> }}
            />,
        },
        offlinepossible: {
            title: t("faq.content.offlinepossible.title"),
            text: <Trans i18nKey="faq.content.offlinepossible.text"
                components={{ Linkabstimmung21: <Link href="https://www.openpetition.de/abstimmung21" /> }}
            />,
        },
        whywebuildit: {
            title: t("faq.content.whywebuildit.title"),
            text: <Trans i18nKey="faq.content.whywebuildit.text" />,
        },
        topics: {
            title: t("faq.content.topics.title"),
            text: <Trans i18nKey="faq.content.topics.text"
                components={{ Linkabstimmung21: <Link href="https://www.openpetition.de/abstimmung21" /> }}
            />,
        },
        populists: {
            title: t("faq.content.populists.title"),
            text: <Trans i18nKey="faq.content.populists.text" />,
        },
        legitimation: {
            title: t("faq.content.legitimation.title"),
            text: <Trans i18nKey="faq.content.legitimation.text" />,
        },
        swiss: {
            title: t("faq.content.swiss.title"),
            text: <Trans i18nKey="faq.content.swiss.text" />,
        },
        extremelawchange: {
            title: t("faq.content.extremelawchange.title"),
            text: <Trans i18nKey="faq.content.extremelawchange.text" />,
        },
        brexit: {
            title: t("faq.content.brexit.title"),
            text: <Trans i18nKey="faq.content.brexit.text" />,
        },
        whydowedoit: {
            title: t("faq.content.whydowedoit.title"),
            text: <Trans i18nKey="faq.content.whydowedoit.text" />,
        },
        security: {
            title: t("faq.content.security.title"),
            text: <Trans i18nKey="faq.content.security.text"
                components={{ Linkblog: <Link href="https://www.opn.vote/" /> }}
            />,
        },
        clear: {
            title: t("faq.content.clear.title"),
            text: <>
                <Trans i18nKey="faq.content.clear.text" />
                <br/>
                <Button type="danger" onClick={clear}>{t("faq.content.clear.button")}</Button>
            </>,
        },
    };

    return (
        <>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("faq.headline.title")}
                    text={t("faq.headline.text")}
                />
            </div>
            <main className="op__contentbox_760">
                <Accordeon
                    contents={faqContent}
                />
            </main>
            <div className="op__center-align">
                <Button
                    onClick={() => history.back()}
                    type="primary"
                >{t("common.back")}</Button>
            </div>
        </>
    );
}
