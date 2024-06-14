'use client';

import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Image from 'next/image';
import Button from './Button'
import styles from '../styles/ScanUploadQRCode.module.css';

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode (props) {

    const { headline, subheadline, uploadSubHeadline, scanSubHeadline } = props;

    const fileRef = useRef(null);
    const [cameraList, setCameraList] = useState([]);
    const [activeCamera, setActiveCamera] = useState();
    const [showStopScanBtn, setShowStopScanBtn] = useState(false);

    useEffect(() => {
      html5QrCode = new Html5Qrcode("reader");
      getCameras();
      const oldRegion = document.getElementById("qr-shaded-region");
      oldRegion && oldRegion.remove();
      console.log(showStopScanBtn);
    }, []);
  
    const startScanClick = () => {
      setShowStopScanBtn(true);
      const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        console.info(decodedResult, decodedText);
        props.onResult(decodedText);
        handleStop();
      };

      html5QrCode
        .start(
          { facingMode: "environment" }, qrConfig, qrCodeSuccessCallback )
        .then(() => {
          const oldRegion = document.getElementById("qr-shaded-region");
          if (oldRegion) {
            oldRegion.innerHTML = "";
          }
        });
    };

    const getCameras = () => {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length) {
            setCameraList(devices);
            setActiveCamera(devices[0]);
          }
        })
        .catch((err) => {
          setCameraList([]);
        });
    };

    const onCameraChange = (e) => {
      if (e.target.selectedIndex) {
        let selectedCamera = e.target.options[e.target.selectedIndex];
        let cameraId = selectedCamera.dataset.key;
        setActiveCamera(cameraList.find((cam) => cam.id === cameraId));
      }
    };

    const handleStop = () => {
      setShowStopScanBtn(false);
      try {
        html5QrCode
          .stop()
          .then((res) => {
            html5QrCode.clear();
          })
          .catch((err) => {
            console.debug(err.message);
          });
      } catch (err) {
        console.debug(err);
      }
    };

    const scanLocalFile = () => {
      fileRef.current.click();
    };
    
    const scanFile = (e) => {
      if (e.target.files.length === 0) {
        // No file there -> do nothing for now
        return;
      }
  
      // Use the first item in the list
      const imageFile = e.target.files[0];
      html5QrCode
        .scanFile(imageFile, /* showImage= */ true)
        .then((qrCodeMessage) => {
          // handover -> do sth with result
          props.onResult(qrCodeMessage);
          html5QrCode.clear();
        })
        .catch((err) => {
          console.debug(`Error scanning file. Reason: ${err}`);
        });
    };
  
    return (
      <>
        <div class="op__contentbox_760">
          <h3>{headline}</h3>
          {subheadline}
        </div>
        <div className="op__outerbox_grey">
          <div className={styles.header}>
            <div className={styles.qrbg}></div>
            <div>
              <h3>QR Code hochladen</h3>
              <p>{uploadSubHeadline}</p>
            </div>
          </div>
          <div className={styles.innerbox}>
            <p>QR Code über den Button auswählen</p>
            <Button 
              onClickAction={scanLocalFile} 
              type="primary"
              text="Bild auswählen"
            />
            <input
              type="file"
              hidden
              ref={fileRef}
              accept="image/*"
              onChange={scanFile}
            />
          </div>
        </div>

        <div className="op__outerbox_grey">
        <div className={styles.header}>
            <div className={styles.qrbg}></div>
            <div>
              <h3>QR Code Scannen</h3>
              <p>{scanSubHeadline}</p>
            </div>
          </div>
          <div className={styles.innerbox}>
            <p>Kamera starten und QR Code vor die Linse halten</p>
            <div id="reader" width="100%"></div>
            <Button 
              onClickAction={() => startScanClick()} 
              type={`${showStopScanBtn ? "hide" : "primary"}`}
              text="Kamera starten"
            />
            <Button
              onClickAction={() => handleStop()}
              type={`${showStopScanBtn ? "primary" : "hide"}`}
              text="Karmera stoppen"
            />
            <p>
            <Button 
              onClickAction={getCameras} 
              text="Geräte-Kameras neu erkennen"
              type="primary"
            />
            </p>
        {cameraList.length == 0 && (<div className="">Keine Kameras erkannt oder Zugriff auf Kameras verweigert</div>)}
        {cameraList.length > 1 && (
          <select onChange={onCameraChange}>
            {cameraList.map((li) => (
              <option
                key={li.id}
                id={li.id}
                defaultValue={activeCamera && activeCamera.id === li.id}
              >
                {li.label}
              </option>
            ))}
          </select>
        )}
        </div>
      </div>
  


      </>
    );
  };
