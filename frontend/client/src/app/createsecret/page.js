'use client';

import React, { useState, useEffect } from "react";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";
import { QRCodeCanvas } from 'qrcode.react';

export default function Home() {
  const [qrCodeRef, setQrCodeRef] = useState();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  const DownloadAsPng = () => {

    var textCanvas = document.getElementById("canvas");
    var textCanvasContext = textCanvas.getContext("2d");
    textCanvasContext.fillStyle = "white";
    textCanvasContext.fillRect(0, 0, canvas.width, canvas.height);
    textCanvasContext.fillStyle = "#000";
    textCanvasContext.lineStyle = "#000";
    textCanvasContext.font = "18px sans-serif";
    textCanvasContext.lineWidth = 2;
    var position = textCanvasContext.width / 2;
    textCanvasContext.textAlign = "center";
    textCanvasContext.fillText('Wahlperso', 100, 50);

    var qrCodeCanvasContext = document.getElementById("qrCodeCanvas");

    textCanvasContext.drawImage(qrCodeCanvasContext, 0, 100,200,200);
    var dataURL = textCanvas.toDataURL("image/png");
    var link = document.createElement('a');
    link.download = "wahlschein.png";
    link.href = textCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    link.click();
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
        {secret.length > 0 && (
          <div>
            {secret}
            <button onClick={DownloadAsPng}>Download QR Code</button>

            <QRCodeCanvas
              value={secret}
              size={200}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"}
              includeMargin={false}
              id="qrCodeCanvas"
            />
            <div id="png-container" style={{display: "none"}}></div>
            <canvas id="canvas" width="200" height="300" style={{display: "none"}} />
          </div>
        )}
      </div>
    </main>
  );
}
