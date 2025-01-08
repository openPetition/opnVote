'use client';
import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Head from "../components/Head";
import Footer from "../components/Footer"
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import './i18n';
import Config from "../../next.config.mjs";
import { useOpnVoteStore } from "../opnVoteStore";

const client = new ApolloClient({
    uri: Config.env.graphConnectUrl,
    cache: new InMemoryCache(),
});

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {

    const { voting, updateVoting } = useOpnVoteStore((state) => state);

    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        const jwtToken = queryParameters.get("jwt");
        const electionId = queryParameters.get("id");

        if (jwtToken && jwtToken.length > 0 && jwtToken != voting.jwt) {
            updateVoting({ jwt: jwtToken })
        }

        //TODO add election well formed .. we will have to put all this into apollo provider
        if (electionId && !isNaN(electionId) && electionId != voting.electionId) {
            updateVoting({ electionId: electionId })
            //reset possible available election data because it could be a mess otherwise
        }
    }, []);

    return (
        <html>
            <body className={inter.className}>
                <ApolloProvider client={client}>
                    <Head />
                    <main>
                        {children}
                    </main>
                    <Footer />
                </ApolloProvider>
            </body>
        </html>
    );
}
