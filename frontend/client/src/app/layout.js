'use client';
import "./globals.css";
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import './i18n';
import Config from "../../next.config.mjs";
import Footer from "@/components/Footer"
import DataLoad from "@/components/DataLoad";
import {useTranslation} from "next-i18next";

const client = new ApolloClient({
    uri: Config.env.graphConnectUrl,
    cache: new InMemoryCache(),
});


export default function RootLayout({ children }) {
    const { t } = useTranslation();

    return (
        <html>
            <body>
                <ApolloProvider client={client}>
                    <title>{t("common.pagetitle")}</title>
                    <DataLoad />
                    <main>
                        {children}
                    </main>
                    <Footer />
                </ApolloProvider>
            </body>
        </html>
    );
}
