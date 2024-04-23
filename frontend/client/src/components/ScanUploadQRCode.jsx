'use client';

import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode (props) {
    const fileRef = useRef(null);
    const [cameraList, setCameraList] = useState([]);
    const [activeCamera, setActiveCamera] = useState();

    useEffect(() => {
      html5QrCode = new Html5Qrcode("reader");
      getCameras();
      const oldRegion = document.getElementById("qr-shaded-region");
      oldRegion && oldRegion.remove();
    }, []);
  
    const startScanClick = () => {
      
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
      <div style={{ position: "relative" }} className="m-10 p-10 bg-grey-100 border border-black rounded">

        <div id="reader" width="100%"></div>

        <button onClick={getCameras} className="m-2 p-1 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">Kameraliste</button>
        {cameraList.length == 0 && (<div className="">Keine Kameras erkannt oder Zugriff auf Kameras verweigert</div>)}
        {cameraList.length > 0 && (
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

        <div>        
          <button onClick={() => startScanClick()} className="m-2 p-3 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">
            Scan QR Code
          </button>
          <button onClick={() => handleStop()} className="m-2 p-3 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">
            Scannen Abbrechen
          </button>
          <button onClick={scanLocalFile} className="m-2 p-3 bg-blue-100 border border-blue-400 text-blue-700 hover:border-transparent rounded">
            Hochladen
          </button>
          <input
            type="file"
            hidden
            ref={fileRef}
            accept="image/*"
            onChange={scanFile}
          />
        </div>

      </div>
    );
  };
