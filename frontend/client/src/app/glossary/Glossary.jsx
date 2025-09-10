import { useTranslation } from "next-i18next";
import Headline from "@/components/Headline";
import Accordeon from "@/components/Accordeon";
import Button from "@/components/Button";

export default function Glossary() {
    const { t } = useTranslation();

    const glossaryContent = {
        anonymouselectionpermit: {
            title: t("glossary.content.anonymouselectionpermit.title"),
            text: t("glossary.content.anonymouselectionpermit.text")
        },
        ballotpaper: {
            title: t("glossary.content.ballotpaper.title"),
            text: t("glossary.content.ballotpaper.text")
        },
        election: {
            title: t("glossary.content.election.title"),
            text: t("glossary.content.election.text")
        },
        electoralauthority: {
            title: t("glossary.content.electoralauthority.title"),
            text: t("glossary.content.electoralauthority.text")
        },
        electionnotification: {
            title: t("glossary.content.electionnotification.title"),
            text: t("glossary.content.electionnotification.text")
        },
        electionpapers: {
            title: t("glossary.content.electionpapers.title"),
            text: t("glossary.content.electionpapers.text")
        },
        electionresultverification: {
            title: t("glossary.content.electionresultverification.title"),
            text: t("glossary.content.electionresultverification.text")
        },
        encryptedvote: {
            title: t("glossary.content.encryptedvote.title"),
            text: t("glossary.content.encryptedvote.text")
        },
        personalelectionpermit: {
            title: t("glossary.content.personalelectionpermit.title"),
            text: t("glossary.content.personalelectionpermit.text")
        },
        voter: {
            title: t("glossary.content.voter.title"),
            text: t("glossary.content.voter.text")
        },
        votingkey: {
            title: t("glossary.content.votingkey.title"),
            text: t("glossary.content.votingkey.text")
        },
    };

    return (
        <>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("glossary.headline.title")}
                    text={t("glossary.headline.text")}
                />
            </div>
            <main className="op__contentbox_760">
                <Accordeon
                    contents={glossaryContent}
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
