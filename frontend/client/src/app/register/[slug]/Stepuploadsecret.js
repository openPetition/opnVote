'use client';

import React, { useState, useEffect } from "react";
import {useStepStore} from "./zustand";
import ReactDOM from 'react-dom';
import jsQR from "jsqr-es6";
// To use Html5QrcodeScanner (more info below)
import {Html5QrcodeScanner} from "html5-qrcode";

// To use Html5Qrcode (more info below)
import {Html5Qrcode} from "html5-qrcode";

export default function Stepuploadsecret() {
  const [file, setFile] = useState(null);
  const qrcodeReaderId = "html5qr-qrcodeReaderId-full-region";
  const [html5QrCodeO, setHtml5QrCodeO] = useState();
  const [html5QrcodeScannerO, sethHml5QrcodeScannerO] = useState();

  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      /* handle success */
  };
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  const qrcodeRegionId = "html5qr-code-full-region";
  const verbose = true;
  // Creates the configuration object for Html5QrcodeScanner.


   const handleFileChange = (e) => {
    console.log(e.width);
    if (e.target.files) {
     // console.log(e.target.result);
      setFile(e.target.files[0]);
    }
  };

  useEffect(() => {

    setHtml5QrCodeO (new Html5Qrcode(qrcodeReaderId));
    sethHml5QrcodeScannerO (new Html5QrcodeScanner(qrcodeRegionId, config, verbose));
    console.log('lels');
  }, []);

  useEffect(() => {


  }, [html5QrcodeScannerO]);

  useEffect(() => {

    if(file) {
      html5QrCodeO.scanFile(file, true).then(decodedText => {
        console.log(decodedText);
      })
    .catch(err => {
      console.log(`Error scanning file. Reason: ${err}`)
    });

  }
  }, [file]);



  return (
    <>
      <div className="">

          <div className="">
              <div className="">Helfen Sie mit, Bürgerbeteiligung zu stärken. Wir wollen Ihren Anliegen Gehör verschaffen und dabei weiterhin unabhängig bleiben.</div>
              <div className="">
                  Wählergeheimnis asd test s
              </div>
              <div>
                <label className="cursor-pointer">
                    Click to select some files...
                    <input
                        style={{ display: "none" }}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}   
                        id="qr-input-file"                     
                        className="text-white bg-op-blue-dark text-center mx-auto rounded w-1/2 block p-2 my-2"
                    />
                </label>

                </div>
                <div id={qrcodeReaderId}></div>
                <div id="html5qr-code-full-region"></div>
          </div>
        
      </div>

    </>
  );
}
