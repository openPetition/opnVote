import type { ReactNode } from "react";

export const metadata = {
    title: "opn.vote admin SDK demo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body
                style={{
                    fontFamily: "system-ui, sans-serif",
                    maxWidth: 760,
                    margin: "2rem auto",
                    padding: "0 1rem",
                    lineHeight: 1.5,
                }}
            >
                {children}
            </body>
        </html>
    );
}
