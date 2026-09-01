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

const diagnosticLabels = {
    expectedDocumentType: 'errorpopup.technicaldetails.scan.expecteddocumenttype',
    inputType: 'errorpopup.technicaldetails.scan.inputtype',
    extractionMethod: 'errorpopup.technicaldetails.scan.extractionmethod',
};

const inputDiagnostics = {
    PDF_PROCESSING: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.pdf',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.pdfprocessing',
    },
    PDF_METADATA: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.pdf',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.pdfmetadata',
    },
    PDF_QR_SCAN: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.pdf',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.pdfrenderedqr',
    },
    IMAGE_QR_SCAN: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.image',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.uploadedimageqr',
    },
    CAMERA_QR_SCAN: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.camera',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.cameraqr',
    },
    TEXT: {
        inputType: 'errorpopup.technicaldetails.scan.value.inputtype.text',
        extractionMethod: 'errorpopup.technicaldetails.scan.value.extraction.text',
    },
};

const getInputErrorLocation = (qrContentType, inputOutputType) => {
    const isTextInput = inputOutputType === globalConst.saveType.CLIPBOARD;

    if (qrContentType === globalConst.qrContentType.KEY) {
        return isTextInput
            ? 'scanuploadqrcode.notification.error.location.keytext'
            : 'scanuploadqrcode.notification.error.location.keyfile';
    }

    return isTextInput
        ? 'scanuploadqrcode.notification.error.location.ballottext'
        : 'scanuploadqrcode.notification.error.location.ballotfile';
};

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

    const getDiagnostics = (diagnosticContext = {}) => {
        const context = {
            expectedDocumentType: qrContentType === globalConst.qrContentType.KEY
                ? 'errorpopup.technicaldetails.scan.value.documenttype.key'
                : 'errorpopup.technicaldetails.scan.value.documenttype.ballot',
            ...diagnosticContext,
        };

        return Object.entries(diagnosticLabels)
            .filter(([key]) => context[key] !== undefined && context[key] !== null && context[key] !== '')
            .map(([key, label]) => ({
                label: t(label),
                value: typeof context[key] === 'string' && context[key].startsWith('errorpopup.')
                    ? t(context[key])
                    : context[key],
            }));
    };

    const showError = (userError, location, caughtError, block, diagnosticContext) => {
        const technicalDetails = caughtError instanceof Error
            ? caughtError.message || caughtError.name
            : t('errorpopup.technicaldetails.unavailable');

        setError({
            userError,
            location,
            module: 'ScanUploadQRCode',
            block,
            technicalDetails,
            diagnostics: getDiagnostics(diagnosticContext),
        });
        console.debug(`Error in ${location}:`, caughtError);
    };

    useEffect(() => {
        html5QrCode = new Html5Qrcode("reader", { formatsToSupport: [0], verbose: false });
        const oldRegion = document.getElementById("qr-shaded-region");
        oldRegion && oldRegion.remove();
    }, []);

    /**
     * checks the inserted code
     * @param {string} code
     * @param {string} inputOutputType
     * @param {object} diagnosticContext
     */
    const checkCodeAndReturn = async (code, inputOutputType, diagnosticContext = {}) => {
        if (!voteClient || !typeof voteClient.importCredentials === 'function' || !typeof voteClient.importMasterKey === 'function') {
            showError(
                new ApplicationNotReadyError(),
                'scanuploadqrcode.notification.error.location.preparation',
                undefined,
                'checkCodeAndReturn',
                diagnosticContext,
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
                    getInputErrorLocation(qrContentType, inputOutputType),
                    caughtError,
                    'checkCodeAndReturn',
                    diagnosticContext,
                );
            }
        } else {
            try {
                const ballotCheck = checkBallot(voting.election, code);

                if (ballotCheck.result !== 'success') {
                    const { key, values = {} } = ballotCheck.technicalDetails;
                    showError(
                        ballotCheck.error,
                        getInputErrorLocation(qrContentType, inputOutputType),
                        new Error(t(key, {
                            ...values,
                            ERROR: values.ERROR || t('errorpopup.technicaldetails.unavailable'),
                            interpolation: { escapeValue: false },
                        })),
                        'checkCodeAndReturn',
                        diagnosticContext,
                    );
                    return;
                }

                voteClient.importCredentials(code);
                props.onResult(ballotCheck.registerCode, inputOutputType);
            } catch (caughtError) {
                showError(
                    inputOutputType === globalConst.saveType.CLIPBOARD ? new BallotTextInvalidError() : new BallotFileInvalidError(),
                    getInputErrorLocation(qrContentType, inputOutputType),
                    caughtError,
                    'checkCodeAndReturn',
                    diagnosticContext,
                );
            }
        }
    };

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
                checkCodeAndReturn(extractCode, globalConst.saveType.PDF, inputDiagnostics.PDF_METADATA);
            } else {
                extractWithConvert(file, inputDiagnostics.PDF_QR_SCAN);
                return;
            }
        } catch (caughtError) {
            showError(
                new BallotFileInvalidError(),
                'scanuploadqrcode.notification.error.location.pdf',
                caughtError,
                'extractData',
                inputDiagnostics.PDF_PROCESSING,
            );
        } finally {
            setIsLoading(false);
        }
    };

    const confirmQRCodeText = () => {
        const index = inputQRCodeText.lastIndexOf(':');
        const code = index === -1 ? inputQRCodeText : inputQRCodeText.substring(index + 1);
        const cleanCode = decodeURI(code).replace(/\s+/g, '');
        checkCodeAndReturn(cleanCode, globalConst.saveType.CLIPBOARD, inputDiagnostics.TEXT);
    };

    const extractWithConvert = async (file, diagnosticContext) => {
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
                imageScan(newImageFile, diagnosticContext);
            } catch (caughtError) {
                showError(
                    new GeneralQRCodeInputError(),
                    'scanuploadqrcode.notification.error.location.pdfscan',
                    caughtError,
                    'extractWithConvert',
                    diagnosticContext,
                );
            }
        } catch (caughtError) {
            showError(
                new GeneralQRCodeInputError(),
                'scanuploadqrcode.notification.error.location.pdfconversion',
                caughtError,
                'extractWithConvert',
                diagnosticContext,
            );
        }
    };

    const imageScan = (newImageFile, diagnosticContext) => {
        html5QrCode
            .scanFile(newImageFile, false)
            .then((qrCodeMessage) => {
                // handover -> do sth with result
                html5QrCode.clear();
                checkCodeAndReturn(qrCodeMessage, globalConst.saveType.IMAGE, diagnosticContext);
                //props.onResult(qrCodeMessage);

            })
            .catch((caughtError) => {
                showError(
                    new GeneralQRCodeInputError(),
                    'scanuploadqrcode.notification.error.location.imagescan',
                    caughtError,
                    'imageScan',
                    diagnosticContext,
                );
            });
    }

    const startScanClick = () => {
        setShowStopScanBtn(true);
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            console.info(decodedResult, decodedText);
            checkCodeAndReturn(decodedText, globalConst.saveType.IMAGE, inputDiagnostics.CAMERA_QR_SCAN);
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
                    'startScanClick',
                    inputDiagnostics.CAMERA_QR_SCAN,
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
        if (selectedFile && selectedFile.type.includes("image/") ) {
            imageScan(selectedFile, inputDiagnostics.IMAGE_QR_SCAN);
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
                        accept="application/pdf, image/png, image/jpg, image/jpeg"
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
