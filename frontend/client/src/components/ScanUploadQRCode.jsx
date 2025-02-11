'use client';

import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Button from './Button';
import styles from '../styles/ScanUploadQRCode.module.css';
import { useTranslation } from 'next-i18next';
import Notification from "./Notification";

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode(props) {
    const { t } = useTranslation();
    const { headline, subheadline, uploadSubHeadline, scanSubHeadline } = props;

    const fileRef = useRef(null);
    const [showStopScanBtn, setShowStopScanBtn] = useState(false);
    const [showScanNotification, setShowScanNotification] = useState(false);

    useEffect(() => {
        html5QrCode = new Html5Qrcode("reader");
        const oldRegion = document.getElementById("qr-shaded-region");
        oldRegion && oldRegion.remove();
    }, []);

    const startScanClick = () => {
        setShowScanNotification(false);
        setShowStopScanBtn(true);
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            console.info(decodedResult, decodedText);
            props.onResult(decodedText);
            handleStop();
        };

        html5QrCode
            .start(
                { facingMode: "environment" }, qrConfig, qrCodeSuccessCallback)
            .then(() => {
                const oldRegion = document.getElementById("qr-shaded-region");
                if (oldRegion) {
                    oldRegion.innerHTML = "";
                }
            }).catch((err) => {
                setShowScanNotification(true);
                setShowStopScanBtn(false);
            });
    };

    const handleStop = () => {
        setShowStopScanBtn(false);
        try {
            html5QrCode
                .stop()
                .then(() => {
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
            <div className="op__contentbox_760">
                <h3>{headline}</h3>
                {subheadline}
            </div>
            <div className="op__outerbox_grey">
                <div className={styles.header}>
                    <div className={styles.qrbg}></div>
                    <div>
                        <h3>{t('scanuploadqrcode.image.headline')}</h3>
                        <p>{uploadSubHeadline}</p>
                    </div>
                </div>
                <div className={styles.innerbox}>
                    <p>{t('scanuploadqrcode.image.instruction')}</p>
                    <Button
                        onClickAction={scanLocalFile}
                        type="primary"
                        text={t('scanuploadqrcode.image.select')}
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
                        <h3>{t('scanuploadqrcode.camera.headline')}</h3>
                        <p>{scanSubHeadline}</p>
                    </div>
                </div>
                <div className={styles.innerbox}>
                    <p>{t('scanuploadqrcode.camera.instruction')}</p>
                    <div id="reader" width="100%"></div>
                    {showScanNotification && (
                        <>
                            <Notification
                                type="error"
                                text={t('scanuploadqrcode.cameraaction.failed')}
                            />
                        </>
                    )}

                    <Button
                        onClickAction={() => startScanClick()}
                        type={`${showStopScanBtn ? "hide" : "primary"}`}
                        text={t('scanuploadqrcode.camera.start')}
                    />
                    <Button
                        onClickAction={() => handleStop()}
                        type={`${showStopScanBtn ? "primary" : "hide"}`}
                        text={t('scanuploadqrcode.camera.stop')}
                    />
                </div>
            </div>
        </>
    );
};
