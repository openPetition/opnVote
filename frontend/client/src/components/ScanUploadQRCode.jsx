'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import Button from './Button';
import styles from '../styles/ScanUploadQRCode.module.css';
import { useTranslation } from 'next-i18next';
import Notification from './Notification';
import NextImage from 'next/image';
import { PDFDocument } from 'pdf-lib';

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode(props) {
    const { t } = useTranslation();
    const { headline, subheadline, uploadSubHeadline, scanSubHeadline } = props;

    const fileRef = useRef(null);
    const [showStopScanBtn, setShowStopScanBtn] = useState(false);
    const [showScanNotification, setShowScanNotification] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        html5QrCode = new Html5Qrcode("reader");
        const oldRegion = document.getElementById("qr-shaded-region");
        oldRegion && oldRegion.remove();

    }, []);

    const extractData = async (file) => {
        if (!(file && file.type === "application/pdf")) {
            return;
        };
        setIsLoading(true);
        try {
            const fileBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(fileBuffer);
            const extractCode = pdfDoc.getSubject().split('QRCODE:')[1];
            if (extractCode && extractCode != 'undefined') {
                props.onResult(extractCode);
            }
        } catch (err) {
            console.debug(`Error scanning File. Reason: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

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


    const scanFile = async (e) => {
        if (e.target.files.length === 0) {
            return;
        }
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === "application/pdf") {
            extractData(selectedFile);
        };

        /** OLD IMAGE upload stuff . we dont want to loose it for now.
        const imageFile = e.target.files[0];
        html5QrCode
            .scanFile(imageFile, true)
            .then((qrCodeMessage) => {
                // handover -> do sth with result
                props.onResult(qrCodeMessage);
                html5QrCode.clear();
            })
            .catch((err) => {
                console.debug(`Error scanning file. Reason: ${err}`);
            });
        **/
    };

    return (
        <>
            <div className="op__contentbox_760">
                <h3>{headline}</h3>
                {subheadline}
            </div>
            <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <div className={styles.header}>
                    <div className={styles.qrbg}>
                        <NextImage
                            priority
                            src="/images/load-picture.svg"
                            height={60}
                            width={60}
                            alt=""
                        />
                    </div>
                    <div>
                        <h3>{t('scanuploadqrcode.image.headline')}</h3>
                        <p>{uploadSubHeadline}</p>
                    </div>
                </div>
                <div className={styles.innerbox}>
                    <Button
                        onClick={scanLocalFile}
                        type="primary_light"
                    >{t('scanuploadqrcode.image.select')}</Button>
                    <input
                        type="file"
                        hidden
                        ref={fileRef}
                        accept="application/pdf"
                        onChange={scanFile}
                    />
                </div>
            </div>

            <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <div className={styles.header}>
                    <div className={styles.qrbg}>
                        <NextImage
                            priority
                            src="/images/scan-qrcode.svg"
                            height={60}
                            width={60}
                            alt=""
                        />
                    </div>
                    <div>
                        <h3>{t('scanuploadqrcode.camera.headline')}</h3>
                        <p>{scanSubHeadline}</p>
                    </div>
                </div>
                <div className={styles.innerbox}>
                    <div id="reader" width="100%"></div>
                    {showScanNotification && (
                        <>
                            <div className="op__margin_standard">
                                <Notification
                                    type="error"
                                    text={t('scanuploadqrcode.cameraaction.failed')}
                                />
                            </div>
                        </>
                    )}

                    <Button
                        onClick={() => startScanClick()}
                        type={`${showStopScanBtn ? "hide" : "primary_light"}`}
                    >{t('scanuploadqrcode.camera.start')}</Button>
                    <Button
                        onClick={() => handleStop()}
                        type={`${showStopScanBtn ? "primary_light" : "hide"}`}
                    >{t('scanuploadqrcode.camera.stop')}</Button>
                </div>
            </div>
        </>
    );
};
