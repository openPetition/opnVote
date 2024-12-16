'use client';

import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Head from "../components/Head";
import Footer from "../components/Footer"
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import './i18n';
import Config from "../../next.config.mjs"

const client = new ApolloClient({
    uri: Config.env.graphConnectUrl,
    cache: new InMemoryCache(),
});

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
    return (
        <html>
            <body className={inter.className}>
                <Head />

                <main>
                    <ApolloProvider client={client}>
                        {children}
                    </ApolloProvider>
                </main>

                <Footer />
            </body>
        </html>
    );
}
