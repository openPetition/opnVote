'use client';
import React, { useState, useEffect } from "react";
import { QRCodeCanvas } from 'qrcode.react';


export default function GenerateQRCode(props) {
  const { text, downloadHeadline } = props;

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
    textCanvasContext.fillText(downloadHeadline, 100, 50);

    var qrCodeCanvasContext = document.getElementById("qrCodeCanvas");

    textCanvasContext.drawImage(qrCodeCanvasContext, 0, 100,200,200);
    var dataURL = textCanvas.toDataURL("image/png");
    var link = document.createElement('a');
    link.download = "wahlschein.png";
    link.href = textCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    link.click();
  }

  const PrintPng = () => {
    const div = document.querySelector('.print-content');


    var qrCodeCanvasContext = document.getElementById("qrCodeCanvas");
    const img = qrCodeCanvasContext.toDataURL({
      format: 'jpeg',
      quality: 0.75
    });
    const singleImg = `<img src=${img} class='image-content' />`
    div.innerHTML = singleImg;


    var windowUrl = 'about:blank';
    var uniqueName = new Date();
    var windowName = 'Print' + uniqueName.getTime();
    var printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=1000000,height=10000');
    printWindow.document.write(div.innerHTML);

    printWindow.document.close();

    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
    return true;

  }

  return (
    <>
        <div className="">
          <div className="noScreen print-content"></div>
            <div id="" className="">
                <QRCodeCanvas
                    value={text}
                    size={200}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"L"}
                    includeMargin={false}
                    id="qrCodeCanvas"
                />
                <canvas 
                    id="canvas" 
                    width="200" 
                    height="300" 
                    style={{display: "none"}} 
                />
            </div>
            <div>
                <button onClick={DownloadAsPng}  className="m-2 p-3 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">
                    Download QR Code
                </button>
                <button onClick={PrintPng}  className="m-2 p-3 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">
                    Print QR Code
                </button>
            </div>
        </div>
    </>
  )
}