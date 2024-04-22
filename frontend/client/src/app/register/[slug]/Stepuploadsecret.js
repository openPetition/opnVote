'use client';

import React, { useState, useEffect } from "react";
import { qrToTokenAndR } from "votingsystem";

// To use Html5QrcodeScanner (more info below)
import HtmlQRCodePlugin from "../../../components/ScanUploadQRCode"

// To use Html5Qrcode (more info below)

export default function Stepuploadsecret() {
  const [decodedValue, setDecodedValue] = useState("");

  useEffect(() => {
    // work with qr code value / decoded value in next step
    if(decodedValue && decodedValue.length > 0 ) 
    {
      console.log('decodedValue: ' + decodedValue);
    }
  }, [decodedValue]);

  return (
    <>
      <div className="">

          <div className="">
              <div className="">Helfen Sie mit, Bürgerbeteiligung zu stärken. Wir wollen Ihren Anliegen Gehör verschaffen und dabei weiterhin unabhängig bleiben.</div>
              <div className="">
                  Wählergeheimnis 
              </div>
              <div>
                <HtmlQRCodePlugin onResult={(res) => setDecodedValue(res)} />
                <br />
                <p style={{ width: "100%", wordWrap: "break-word" }}>
                  <strong>Value:</strong>
                  {decodedValue}
                </p>
              </div>
          </div>
      </div>

    </>
  );
}
