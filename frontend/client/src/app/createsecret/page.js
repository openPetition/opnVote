'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import { Canvg } from 'canvg';

export default function Home() {
  const [qrCodeRef, setQrCodeRef] = useState();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  const downloadQRCode = () => {
    let svgElement = qrCodeRef.current;
    if (!svgElement.match(/xmlns=\"/mi)){
      svgElement = svgElement.replace ('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ') ;  
    }

    let clonedSvgElement = svgElement.cloneNode(true);
    let outerHTML = clonedSvgElement.outerHTML,
    blob = new Blob([outerHTML],{type:'image/png+xml;charset=utf-8'});
    let URL = window.URL || window.webkitURL || window;
    let blobURL = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobURL;
    link.download = 'download.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(blobURL), 5000);
  };

  const DownloadAsPng = () => {
    var canvas = document.getElementById("canvas");
    const svgSElement = document.getElementById('qrCodeEl')
    var svgString = new XMLSerializer().serializeToString(svgSElement);
    var ctx = canvas.getContext("2d");
    var DOMURL = self.URL || self.webkitURL || self;
    var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    var url = DOMURL.createObjectURL(svg);
    let img = new Image(100, 200);
    img.onload = function() {
      ctx.drawImage(img, 0, 0);

      var png = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.setAttribute('download', 'wahlperso.png');
      link.setAttribute('href', png.replace("image/png", "image/octet-stream"));
      link.click();



      document.getElementById('png-container').innerHTML = '<img src="'+png+'"/>';
      DOMURL.revokeObjectURL(png);
    };
    img.src = url;


  }


  async function callClick() {
    setLoading('loading');
    let values = await generateMasterTokenAndMasterR();
    let create = await concatTokenAndRForQR(values.masterToken, values.masterR);
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
            <button onClick={DownloadAsPng}>Download QR Code</button>
            <QRCode
              size={256}
              style={{ height: "auto", maxWidth: "300px", width: "100%" }}
              value={secret}
              viewBox={`0 0 256 256`}
              ref={qrCodeRef}
              id="qrCodeEl"
              />

<div id="png-container"></div>
<canvas id="canvas" width="256" height="256" style={{display: "none"}}></canvas>

          </div>
        }
      </div>
    </main>
  );
}
