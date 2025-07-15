'use client';
import "./globals.css";
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import './i18n';
import Config from "../../next.config.mjs";
import Footer from "@/components/Footer"
import DataLoad from "@/components/DataLoad";

const client = new ApolloClient({
    uri: Config.env.graphConnectUrl,
    cache: new InMemoryCache(),
});


export default function RootLayout({ children }) {

    return (
        <html>
            <body>
                <ApolloProvider client={client}>

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
