import {useTranslation} from "next-i18next";
import Headline from "@/components/Headline";
import Accordion from "@/components/Accordion";

export default function Faq() {
    const {t} = useTranslation();


    return (
        <>
            <div className="op__margin_2_bottom">
                <Headline
                    title={t("faq.headline.title")}
                    text={t("faq.headline.text")}
                />
            </div>
            <main className="op__contentbox_760">
                <Accordion/>
            </main>
        </>
    );
}
