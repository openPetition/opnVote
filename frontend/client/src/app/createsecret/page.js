'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import Image from "next/image";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";

export default function Home() {
  const [qrCodeRef, setQrCodeRef] = useState();

  const downloadQRCode = () => {
    const svgElement = qrCodeRef.current;
    let clonedSvgElement = svgElement.cloneNode(true);
    let outerHTML = clonedSvgElement.outerHTML,
    blob = new Blob([outerHTML],{type:'image/svg+xml;charset=utf-8'});
    let URL = window.URL || window.webkitURL || window;
    let blobURL = URL.createObjectURL(blob);
    console.log(blobURL);
    const link = document.createElement("a");
    link.href = blobURL;
    link.download = 'download.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(blobURL), 5000);
  };


  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  async function callClick() {
    setLoading('loading');
    let values = await generateMasterTokenAndMasterR();
    console.log(values);
    let create = await concatTokenAndRForQR(values.masterToken, values.masterR);
    console.log(create);
    setSecret(create);
    setQrCodeRef(React.createRef());
    setLoading('loaded');

  }

  return (
    <main className="">
      <div className="bg-op-blue">
        <div className="flex-col items-center justify-between p-5 text-sm">
          Die Generierung und Speicherung deines Geheimnisses erfolgt komplett „offline“. Wenn du ganz sicher gehen will, kannst du deine Internetverbindung jetzt deaktivieren und später wieder aktivieren.
        </div>
      </div>
      <div className="items-center">
        <div id="key" className="self-center mx-auto m-2"></div>
        <div className={loading.length > 0 && loading == 'loaded' ? 'hidden' : ''}>
          <button onClick={callClick} className="items-center bg-op-btn-bg font-bold py-2 px-4 rounded m-2 mx-auto block">
            Generieren
          </button>
        </div>
      </div>
      <div className="m-2  m-5 mx-auto break-words p-5">
        {secret.length > 0 &&
          <div>
            {secret}
            <button onClick={downloadQRCode}>Download QR Code</button>
            <QRCode
              size={256}
              style={{ height: "auto", maxWidth: "300px", width: "100%" }}
              value={secret}
              viewBox={`0 0 256 256`}
              ref={qrCodeRef}
              id="qrCodeEl"
              />

          </div>
        }
      </div>
    </main>
  );
}
