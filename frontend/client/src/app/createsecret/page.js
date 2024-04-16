'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import { QRCodeCanvas } from 'qrcode.react';

export default function Home() {
  const [qrCodeRef, setQrCodeRef] = useState();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  const DownloadAsPng = () => {
    var canvas = document.getElementById("canvas");
    const svgSElement = document.getElementById('qrCodeEl')
    var svgString = new XMLSerializer().serializeToString(svgSElement);
    var context = canvas.getContext("2d");
    var DOMURL = self.URL || self.webkitURL || self;
    var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    var url = DOMURL.createObjectURL(svg);
    let img = new Image(300, 200);
    img.onload = function() {
      context.drawImage(img, 0, 0);
      context.lineWidth = 1;
      context.fillStyle = "#CC00FF";
      context.lineStyle = "#ffff00";
      context.font = "18px sans-serif";
      context.fillText('beschriftung', 50, 50);

      var png = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      const downloadlink = document.createElement("a");
      downloadlink.setAttribute('download', 'wahlperso.png');
      downloadlink.setAttribute('href', png);
      downloadlink.click();
      document.getElementById('png-container').innerHTML = '<img src="'+png+'"/>';
      DOMURL.revokeObjectURL(png);
    };
    img.src = url;
  }

  async function generateAndCreate() {
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
          <button onClick={generateAndCreate} className="items-center bg-op-btn-bg font-bold py-2 px-4 rounded m-2 mx-auto block">
            Generieren
          </button>
        </div>
      </div>
      <div className="m-2  m-5 mx-auto break-words p-5">
        {secret.length > 0 &&
          <div>
            {secret}
            <button onClick={DownloadAsPng}>Download QR Code</button>
            <div id="qrCodePainting">
              <h1>W</h1>
              <QRCode
                size={200}
                style={{ height: "auto", maxWidth: "300px", width: "100%" }}
                value={secret}
                viewBox={`0 0 200 200`}
                ref={qrCodeRef}
                id="qrCodeEl"
                />
            </div>


            <QRCodeCanvas
              value={secret}
              size={200}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"}
              includeMargin={false}
            />


<div id="png-container" style={{display: "none"}}></div>
<canvas id="canvas" width="200" height="300" style={{display: "none"}}></canvas>

          </div>
        }
      </div>
    </main>
  );
}
