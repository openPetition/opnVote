'use client';
import React, { useState, useEffect } from "react";
import { QRCodeCanvas } from 'qrcode.react';
import styles from '../../styles/GenerateQRCode.module.css';
import Image from 'next/image';
import Button from './Button'

export default function GenerateQRCode(props) {
  const { headline, subheadline, text, downloadHeadline } = props;

  const DownloadAsPng = () => {
    const textCanvas = document.getElementById("canvas");
    const textCanvasContext = textCanvas.getContext("2d");
    textCanvasContext.fillStyle = "white";
    textCanvasContext.fillRect(0, 0, textCanvas.width, textCanvas.height);
    textCanvasContext.fillStyle = "#000";
    textCanvasContext.lineStyle = "#000";
    textCanvasContext.font = "18px sans-serif";
    textCanvasContext.lineWidth = 2;
    textCanvasContext.textAlign = "center";
    textCanvasContext.fillText(downloadHeadline, 100, 50);

    const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");

    textCanvasContext.drawImage(qrCodeCanvasContext, 0, 100,200,200);
    const dataURL = textCanvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.download = "wahlschein.png";
    link.href = textCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    link.click();
  }

  const PrintPng = () => {
    const div = document.querySelector('.print-content');

    const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");
    const img = qrCodeCanvasContext.toDataURL({
      format: 'jpeg',
      quality: 0.75
    });
    const singleImg = `<img src=${img} class='image-content' />`
    div.innerHTML = singleImg;

    const windowUrl = 'about:blank';
    const uniqueName = new Date();
    const windowName = 'Print' + uniqueName.getTime();
    const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=1000000,height=10000');
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
        <div className="op__outerbox_grey">
          <div className={styles.innerbox}>
            <div className="noScreen print-content"></div>
              <strong>{headline}</strong>
              <p>{subheadline}</p>
              <div className={styles.zigzagbox}>
                  <Image
                    src="/images/GenerateQRCodeDesignElement.png" 
                    height={75}
                    width={300}
                    style={{margin: "1rem auto"}} 
                  />
                  <h3>{downloadHeadline}</h3>
                  <QRCodeCanvas
                      value={text}
                      size={300}
                      bgColor={"#ffffff"}
                      fgColor={"#000000"}
                      level={"L"}
                      includeMargin={false}
                      id="qrCodeCanvas"
                      style={{margin: "1rem auto"}} 
                  />
                  <canvas 
                      id="canvas" 
                      width="200" 
                      height="300" 
                      style={{display: "none"}} 
                  />
              </div>
              <div className={styles.buttonbox}>

                <Button 
                  onClickAction={DownloadAsPng} 
                  type="primary"
                  text="Bild speichern"
                  style={{display: 'block', width: '100%'}} 
                />

                <Button 
                  onClickAction={PrintPng} 
                  type="primary"
                  text="Bild drucken"
                  style={{display: 'block', width: '100%'}} 
                />
              </div>
          </div>
        </div>
    </>
  )
}