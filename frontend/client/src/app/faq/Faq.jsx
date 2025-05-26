import {useTranslation} from "next-i18next";
import Headline from "@/components/Headline";
import Accordion from "@/components/Accordion";
import Button from "@/components/Button";
import {useOpnVoteStore} from "@/opnVoteStore";

export default function Faq() {
    const {t} = useTranslation();
    const { updatePage, page } = useOpnVoteStore((state) => state);


    return (
        <>
            <title>{t("faq.title")}</title>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("faq.headline.title")}
                    text={t("faq.headline.text")}
                />
            </div>
            <main className="op__contentbox_760">
                <Accordion/>
            </main>
            <div className="op__center-align">
                <Button
                    onClickAction={() => updatePage( { previous: page.current, current: page.previous})}
                    text={t("common.back")}
                    type="primary"
                />
            </div>
        </>
    );
}
