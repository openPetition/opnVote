'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import Head from "../components/Head";
import Footer from "../components/Footer"

import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";

const client = new ApolloClient({
    uri: "http://152.53.65.200:8000/subgraphs/name/opnvote-001",
    cache: new InMemoryCache(),
});

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
    return (
        <html lang="en">
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
