import { useTranslation } from "next-i18next";
import Headline from "@/components/Headline";
import Accordion from "@/components/Accordion";
import Button from "@/components/Button";

export default function Faq() {
    const { t } = useTranslation();

    const faqContent = {
        anonymouselectionpermit: {
            title: t("faq.content.anonymouselectionpermit.title"),
            text: t("faq.content.anonymouselectionpermit.text")
        },
        ballotpaper: {
            title: t("faq.content.ballotpaper.title"),
            text: t("faq.content.ballotpaper.text")
        },
        election: {
            title: t("faq.content.election.title"),
            text: t("faq.content.election.text")
        },
        electoralauthority: {
            title: t("faq.content.electoralauthority.title"),
            text: t("faq.content.electoralauthority.text")
        },
        electionnotification: {
            title: t("faq.content.electionnotification.title"),
            text: t("faq.content.electionnotification.text")
        },
        electionpapers: {
            title: t("faq.content.electionpapers.title"),
            text: t("faq.content.electionpapers.text")
        },
        electionresultverification: {
            title: t("faq.content.electionresultverification.title"),
            text: t("faq.content.electionresultverification.text")
        },
        encryptedvote: {
            title: t("faq.content.encryptedvote.title"),
            text: t("faq.content.encryptedvote.text")
        },
        personalelectionpermit: {
            title: t("faq.content.personalelectionpermit.title"),
            text: t("faq.content.personalelectionpermit.text")
        },
        voter: {
            title: t("faq.content.voter.title"),
            text: t("faq.content.voter.text")
        },
        votingkey: {
            title: t("faq.content.votingkey.title"),
            text: t("faq.content.votingkey.text")
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
                <Accordion
                    contents={faqContent}
                />
            </main>
            <div className="op__center-align">
                <Button
                    onClickAction={() => history.back()}
                    text={t("common.back")}
                    type="primary"
                />
            </div>
        </>
    );
}
