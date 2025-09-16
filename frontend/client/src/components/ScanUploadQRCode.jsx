'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import Button from './Button';
import styles from '../styles/ScanUploadQRCode.module.css';
import { useTranslation } from 'next-i18next';
import Notification from './Notification';
import NextImage from 'next/image';
import { PDFDocument } from 'pdf-lib';
import Modal from "@/components/Modal";
import BallotInvalidError from '@/errors/BallotInvalidError';

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode(props) {
    const { t } = useTranslation();
    const { headline, subheadline, uploadSubHeadline, scanSubHeadline } = props;

    const fileRef = useRef(null);
    const [showStopScanBtn, setShowStopScanBtn] = useState(false);
    const [showScanNotification, setShowScanNotification] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

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

        const fileBuffer = await file.arrayBuffer();
        try {
            const pdfDoc = await PDFDocument.load(fileBuffer, {ignoreEncryption: true});
            const extractCode = pdfDoc.getSubject()?.split('QRCODE:')[1];
            if (extractCode && extractCode != 'undefined') {
                props.onResult(extractCode);
            } else {
                extractWithConvert(file);
                return;
            }
        } catch (err) {
            setError(new BallotInvalidError());
            console.debug(err);
        }
        setIsLoading(true);
    };

    const extractWithConvert = async (file) => {
        try {
            let pdfjsLib = await import('pdfjs-dist', { ssr: false });
            pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + "/pdf.worker.min.js";
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            try {
                // Convert canvas to blob
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
                const newImageFile = new File([blob], `qrcode.png`, { type: "image/png" });
                html5QrCode
                    .scanFile(newImageFile, false)
                    .then((qrCodeMessage) => {
                        // handover -> do sth with result
                        props.onResult(qrCodeMessage);
                        html5QrCode.clear();
                    })
                    .catch((err) => {
                        console.debug(`Error scanning file. Reason: ${err}`);
                        setError(new BallotInvalidError());
                    });
            } catch (qrError) {
                console.log(`No QR code found`);
                setError(new BallotInvalidError());
            }
        } catch (err) {
            console.log("Error processing PDF: " + err.message);
            setError(new BallotInvalidError());
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
        e.target.value = null;

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
            {error && (
                <Modal
                    showModal={error}
                    headerText={t(error.title)}
                    ctaButtonText={t(error.button)}
                    ctaButtonFunction={() => setError(null)}
                >
                    <Notification
                        type="error"
                        text={t(error.text)}
                    />
                </Modal>
            )}

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
