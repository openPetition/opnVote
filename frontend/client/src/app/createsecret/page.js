'use client';
import React, { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import GenerateQRCode from "../../components/GenerateQRCode";

export default function Home() {
    const [secret, setSecret] = useState('');
    const [loading, setLoading] = useState('');

    async function generateAndCreate() {
        setLoading('loading');
        let values = await generateMasterTokenAndMasterR();
        let create = await concatTokenAndRForQR(values.masterToken, values.masterR);
        setSecret(create);
        setLoading('loaded');
    }

    return (
        <main className="">
            <div className="bg-op-blue">
                <div className="flex-col items-center justify-between p-5 text-sm">
                    Die Generierung und Speicherung deines Geheimnisses erfolgt komplett „offline“. Wenn du ganz sicher gehen will, kannst du deine Internetverbindung jetzt deaktivieren und später wieder aktivieren.
                </div>
            </div>
            {secret.length === 0 && (
                <>
                    <div className="items-center">
                        <div id="key" className="self-center mx-auto m-2"></div>
                        <div className={loading.length > 0 && loading == 'loaded' ? 'hidden' : ''}>
                            <button onClick={generateAndCreate} className="items-center bg-op-btn-bg font-bold py-2 px-4 rounded m-2 mx-auto block">
                                Generieren
                            </button>
                        </div>
                    </div>
                </>
            )}
            <div className="m-2  m-5 mx-auto break-words p-5">
                {secret.length > 0 && (
                    <>
                        <GenerateQRCode
                            headline="Als Bild speichern"
                            subheadline="Sie können den QR-Code mit dem persönlichen Wahlgeheimnis als Bild speichern."
                            text={secret}
                            downloadHeadline="Wahlgeheimnis"
                        />
                    </>
                )}
            </div>
        </main>
    );
}
