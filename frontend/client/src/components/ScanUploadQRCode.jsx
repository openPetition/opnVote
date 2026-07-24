'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import Button from './Button';
import styles from '../styles/ScanUploadQRCode.module.css';
import { useTranslation } from 'next-i18next';
import NextImage from 'next/image';
import { PDFDocument } from 'pdf-lib';
import ErrorPopup from './ErrorPopup';
import {
    BallotTextInvalidError,
    BallotFileInvalidError,
    ApplicationNotReadyError,
    KeyTextInvalidError,
    KeyFileInvalidError,
    GeneralQRCodeInputError,
} from '@/errors';
import globalConst from '@/constants';
import { useOpnVoteStore } from '@/opnVoteStore';
import { checkBallot } from '@/util';

const qrConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
let html5QrCode;

export default function ScanUploadQRCode(props) {
    const { voting, voteClient } = useOpnVoteStore((state) => state);
    const { t } = useTranslation();
    const {
        headline,
        subheadline,
        uploadHeadline,
        uploadSubHeadline,
        scanSubHeadline,
        insertAsTextHeadline,
        insertAsTextSubHeadline,
        insertAsTextPlaceholder,
        insertAsTextButton,
        qrContentType,
    } = props;

    const fileRef = useRef(null);
    const [showStopScanBtn, setShowStopScanBtn] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [inputQRCodeText, setInputQRCodeText] = useState('');
    const [isQrTextInputActivated, setIsQrTextInputActivated] = useState(false);

    const [error, setError] = useState(null);

    const showError = (userError, location, caughtError, block) => {
        const technicalDetails = caughtError instanceof Error
            ? caughtError.message || caughtError.name
            : t('errorpopup.technicaldetails.unavailable');

        setError({
            userError,
            location,
            module: 'ScanUploadQRCode',
            block,
            technicalDetails,
        });
        console.debug(`Error in ${location}:`, caughtError);
    };

    useEffect(() => {
        html5QrCode = new Html5Qrcode("reader", {formatsToSupport: [0]});
        const oldRegion = document.getElementById("qr-shaded-region");
        oldRegion && oldRegion.remove();
    }, []);

    /**
     * checks the inserted code
     * @param {string} code
     * @param {string} inputOutputType
     */
    const checkCodeAndReturn = async (code, inputOutputType) => {
        if (!voteClient || !typeof voteClient.importCredentials === 'function' || !typeof voteClient.importMasterKey === 'function') {
            showError(
                new ApplicationNotReadyError(),
                'scanuploadqrcode.notification.error.location.preparation',
                undefined,
                'checkCodeAndReturn'
            );
            return;
        }
        if (qrContentType == globalConst.qrContentType.KEY) {
            try {
                const result = voteClient.importMasterKey(code);
                props.onResult(code, inputOutputType);
            } catch (caughtError) {
                showError(
                    inputOutputType === globalConst.saveType.CLIPBOARD ? new KeyTextInvalidError() : new KeyFileInvalidError(),
                    inputOutputType === globalConst.saveType.CLIPBOARD
                        ? 'scanuploadqrcode.notification.error.location.keytext'
                        : 'scanuploadqrcode.notification.error.location.keyfile',
                    caughtError,
                    'checkCodeAndReturn'
                );
            }
        } else {
            try {
                const ballotCheck = checkBallot(voting.election, code);

                if (ballotCheck.result !== 'success') {
                    const { key, values = {} } = ballotCheck.technicalDetails;
                    showError(
                        ballotCheck.error,
                        inputOutputType === globalConst.saveType.CLIPBOARD
                            ? 'scanuploadqrcode.notification.error.location.ballottext'
                            : 'scanuploadqrcode.notification.error.location.ballotfile',
                        new Error(t(key, {
                            ...values,
                            ERROR: values.ERROR || t('errorpopup.technicaldetails.unavailable'),
                        })),
                        'checkCodeAndReturn'
                    );
                    return;
                }

                voteClient.importCredentials(code);
                props.onResult(ballotCheck.registerCode, inputOutputType);
            } catch (caughtError) {
                showError(
                    inputOutputType === globalConst.saveType.CLIPBOARD ? new BallotTextInvalidError() : new BallotFileInvalidError(),
                    inputOutputType === globalConst.saveType.CLIPBOARD
                        ? 'scanuploadqrcode.notification.error.location.ballottext'
                        : 'scanuploadqrcode.notification.error.location.ballotfile',
                    caughtError,
                    'checkCodeAndReturn'
                );
            }
        }
    }

    const extractData = async (file) => {
        if (!(file && file.type === "application/pdf")) {
            return;
        };
        setIsLoading(true);

        try {
            const fileBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
            const extractCode = pdfDoc.getSubject()?.split('QRCODE:')[1];
            if (extractCode && extractCode != 'undefined') {
                checkCodeAndReturn(extractCode, globalConst.saveType.PDF);
            } else {
                extractWithConvert(file);
                return;
            }
        } catch (caughtError) {
            showError(
                new BallotFileInvalidError(),
                'scanuploadqrcode.notification.error.location.pdf',
                caughtError,
                'extractData'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const confirmQRCodeText = () => {
        const index = inputQRCodeText.lastIndexOf(':');
        const code = index === -1 ? inputQRCodeText : inputQRCodeText.substring(index + 1);
        const cleanCode = code.replace(/\s+/g, '');
        checkCodeAndReturn(cleanCode, globalConst.saveType.CLIPBOARD);
    }

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
                imageScan(newImageFile);
            } catch (caughtError) {
                showError(
                    new GeneralQRCodeInputError(),
                    'scanuploadqrcode.notification.error.location.pdfscan',
                    caughtError,
                    'extractWithConvert'
                );
            }
        } catch (caughtError) {
            showError(
                new GeneralQRCodeInputError(),
                'scanuploadqrcode.notification.error.location.pdfconversion',
                caughtError,
                'extractWithConvert'
            );
        }
    };

    const imageScan = (newImageFile) => {
        html5QrCode
            .scanFile(newImageFile, false)
            .then((qrCodeMessage) => {
                // handover -> do sth with result
                html5QrCode.clear();
                checkCodeAndReturn(qrCodeMessage, globalConst.saveType.IMAGE);
                //props.onResult(qrCodeMessage);

            })
            .catch((caughtError) => {
                showError(
                    new GeneralQRCodeInputError(),
                    'scanuploadqrcode.notification.error.location.imagescan',
                    caughtError,
                    'imageScan'
                );
            });
    }

    const startScanClick = () => {
        setShowStopScanBtn(true);
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            console.info(decodedResult, decodedText);
            checkCodeAndReturn(decodedText, globalConst.saveType.IMAGE);
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
            }).catch((caughtError) => {
                setShowStopScanBtn(false);
                showError(
                    new GeneralQRCodeInputError(),
                    'scanuploadqrcode.notification.error.location.camerastart',
                    caughtError,
                    'startScanClick'
                );
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
                .catch((caughtError) => {
                    showError(
                        new GeneralQRCodeInputError(),
                        'scanuploadqrcode.notification.error.location.camerastop',
                        caughtError,
                        'handleStop'
                    );
                });
        } catch (caughtError) {
            showError(
                new GeneralQRCodeInputError(),
                'scanuploadqrcode.notification.error.location.camerastop',
                caughtError,
                'handleStop'
            );
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
        if (selectedFile && selectedFile.type === "image/png") {
            imageScan(selectedFile);
        };
        e.target.value = null;
    };

    return (
        <>
            <ErrorPopup error={error} onClose={() => setError(null)} />

            <div className="op__contentbox_760">
                <h3>{headline}</h3>
                {subheadline}
            </div>

            <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <div className={styles.header}>
                    <div className={styles.qrbg}>
                        <NextImage
                            priority
                            src="/images/load-string.svg"
                            height={60}
                            width={60}
                            alt=""
                        />
                    </div>
                    <div>
                        <h3>{insertAsTextHeadline}</h3>
                        <p>{insertAsTextSubHeadline}</p>
                    </div>
                </div>
                <div className={styles.innerbox}>
                    {!isQrTextInputActivated && (
                        <Button
                            onClick={() => setIsQrTextInputActivated(true)}
                            type="primary_light"
                            className={isQrTextInputActivated ? 'op__display-none' : 'op__display-block'}
                        >
                            {insertAsTextButton}
                        </Button>
                    )}

                    {isQrTextInputActivated && (
                        <>
                            <textarea
                                className={styles.qrinput}
                                name="qrTextInput"
                                rows="4"
                                value={inputQRCodeText}
                                onChange={(e) => setInputQRCodeText(e.target.value)}
                                placeholder={insertAsTextPlaceholder}
                            />
                            <Button
                                onClick={confirmQRCodeText}
                                type="primary_light"
                            >{t('common.confirm')}</Button>
                            <Button
                                onClick={() => setIsQrTextInputActivated(false)}
                                type="secondary"
                                style={{ marginLeft: '10px', padding: '.25rem' }}
                            >
                                {t('common.abort')}
                            </Button>
                        </>
                    )}
                </div>
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
                        <h3>{uploadHeadline ? uploadHeadline : t('scanuploadqrcode.image.headline')}</h3>
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
                        accept="application/pdf, image/png"
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
