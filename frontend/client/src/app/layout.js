'use client';
import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import './i18n';
import Config from "../../next.config.mjs";
import { useOpnVoteStore } from "../opnVoteStore";
import Head from "@/components/Head";
import Footer from "@/components/Footer"
import DataLoad from "@/components/DataLoad";

const client = new ApolloClient({
    uri: Config.env.graphConnectUrl,
    cache: new InMemoryCache(),
});

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {

    return (
        <html>
            <body className={inter.className}>
                <ApolloProvider client={client}>
                    <Head />
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
