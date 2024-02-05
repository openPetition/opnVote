'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import Image from "next/image";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";

export default function Home() {

  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  async function callClick() {
    setLoading('loading');
    let values = await generateMasterTokenAndMasterR();
    console.log(values);
    let create = await concatTokenAndRForQR(values.masterToken, values.masterR);
    console.log(create);
    setSecret(create);
    setLoading('loaded');
  }

  return (
    <main className="">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div id="logo"></div>
        <div>
        </div>
      </div>
      <div className="bg-op-blue">
        <div className="flex-col items-center justify-between p-5 text-sm">
          Die Generierung und Speicherung deines Geheimnisses erfolgt komplett „offline“. Wenn du ganz sicher gehen will, kannst du deine Internetverbindung jetzt deaktivieren und später wieder aktivieren.
        </div>
      </div>
      <div className="items-center">
        <div id="key" className="self-center mx-auto m-2"></div>
        <div className={loading.length > 0 && loading == 'loaded' ? 'hidden' : ''}>
          <button onClick={callClick} className="items-center bg-op-btn-bg text-white font-bold py-2 px-4 rounded m-2 mx-auto block">
            Generieren
          </button>
        </div>
      </div>
      <div className="m-2  m-5 mx-auto break-words p-5">
        {secret.length > 0 &&
          <div>
            {secret}

            <QRCode
              size={256}
              style={{ height: "auto", maxWidth: "300px", width: "100%" }}
              value={secret}
              viewBox={`0 0 256 256`}
              />

          </div>
        }
      </div>
    </main>
  );
}
