'use client';
import { useState, useEffect } from "react";
import { QRCodeCanvas } from 'qrcode.react';
import styles from '../styles/GenerateQRCode.module.css';
import PropTypes from "prop-types";
import { File, Copy, FileImage, CircleCheck } from "lucide-react";
import { useTranslation } from "next-i18next";
import { createPDF } from "@/save-pdf";
import Button from './Button';
import globalConst from "@/constants";
import ErrorPopup from './ErrorPopup';
import { ClipboardCopyError } from '@/errors';
import { saveAs } from 'file-saver';

export default function GenerateQRCode(props) {
    const {
        headline,
        subheadline,
        qrCodeString,
        downloadHeadline,
        copyableTextType,
        downloadSubHeadline,
        downloadFilename,
        headimage,
        pdfQRtype,
        afterSaveFunction,
        saved,
        savedAs,
        pdfInformation,
    } = props;
    const { t } = useTranslation();
    const [showCodeStringCopied, setShowCodeStringCopied] = useState(false);
    const [errorPopup, setErrorPopup] = useState(null);
    const [pdf, setPdf] = useState(null);
    const [image, setImage] = useState(null);
    const [lastActivation, setLastActivation] = useState('');

    const userAgent = navigator.userAgent;
    const isIOS =
            /iPad|iPhone|iPod/.test(userAgent) ||
            (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);

    const isSafari =
        /Safari/.test(userAgent) &&
        !/Chrome|CriOS|FxiOS|EdgiOS|Edg|OPR|Opera/.test(userAgent);

    const canShare = !!navigator.canShare; // would be better, if we could check canShare({files: [FILE]})

    const downloadPdf = async () => {
        if (isIOS && canShare && navigator.canShare({files: [pdf]})) {
            navigator.share({files: [pdf]}).catch((error) => {
                if (typeof error != 'object' || !error.name || error.name != 'AbortError') {
                    saveAs(pdf, downloadFilename + '.pdf');
                }
            });
        } else {
            saveAs(pdf, downloadFilename + '.pdf');
        }
        afterSaveFunction(globalConst.saveType.PDF);
    };

    const downloadImage = async () => {
        if (isIOS && canShare && navigator.canShare({files: [image]})) {
            navigator.share({files: [image]}).catch((error) => {
                if (typeof error != 'object' || !error.name || error.name != 'AbortError') {
                    saveAs(pdf, downloadFilename + '.pdf');
                }
            });
        } else {
            saveAs(image, downloadFilename + '.png');
        }
        afterSaveFunction(globalConst.saveType.IMAGE);
    };

    const generatePdf = async () => {
        if (pdf) {
            return;
        }
        setPdf(await createPDF(qrCodeString, downloadHeadline, downloadSubHeadline, downloadFilename, pdfQRtype, pdfInformation));
    };

    useEffect(() => {
        generatePdf();
        generateImage();
    }, []);

    const copiedAsText = async () => {
        setShowCodeStringCopied(false);

        if (!navigator.clipboard?.writeText) {
            showCopyError(new Error('Clipboard API is not available.'));
            return;
        }

        try {
            await navigator.clipboard.writeText(downloadHeadline + ': ' + qrCodeString);
            setShowCodeStringCopied(true);
            afterSaveFunction(globalConst.saveType.CLIPBOARD);
            setTimeout(() => {
                setShowCodeStringCopied(false);
            }, 4000);
        } catch (caughtError) {
            showCopyError(caughtError);
        }
    };

    const showCopyError = (caughtError) => {
        setErrorPopup({
            userError: new ClipboardCopyError(),
            module: 'GenerateQRCode',
            block: 'copiedAsText',
            copyableText: `${downloadHeadline}: ${qrCodeString}`,
            copyableTextType,
            technicalDetails: caughtError instanceof Error
                ? caughtError.message || caughtError.name
                : t('errorpopup.technicaldetails.unavailable'),
        });
    };

    const getWordWrappedLines = (context, text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const width = context.measureText(testLine).width;

            if (width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    };

    const generateImage = () => {
        if (image) {
            return;
        }
        const textCanvas = document.getElementById("canvas");
        const textCanvasContext = textCanvas.getContext("2d");

        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.src = '/images/opnVote-logo.svg';

        logoImg.onload = function () {
            const baseHeight = 400;
            const lineHeightSubheadline = 20;
            const subheadlineStartY = 120;
            const textMaxWidth = 240;

            let subheadlineLines = [];

            if (downloadSubHeadline?.length > 0) {
                textCanvasContext.font = "14px sans-serif";
                subheadlineLines = getWordWrappedLines(textCanvasContext, downloadSubHeadline, textMaxWidth);
            }

            textCanvas.height = baseHeight + (subheadlineLines.length * lineHeightSubheadline);

            textCanvasContext.fillStyle = "white";
            textCanvasContext.fillRect(0, 0, textCanvas.width, textCanvas.height);

            const logoWidth = 116;
            const logoHeight = 24;
            const logoX = 150 - (logoWidth / 2);
            const logoY = 20;
            textCanvasContext.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);

            textCanvasContext.fillStyle = "#000";
            textCanvasContext.font = "18px sans-serif";
            textCanvasContext.textAlign = "center";
            textCanvasContext.fillText(downloadHeadline, 150, 90);

            let moveQRCodeDownPixel = 120;

            if (subheadlineLines.length > 0) {
                textCanvasContext.fillStyle = "#000";
                textCanvasContext.font = "14px sans-serif";
                textCanvasContext.textAlign = "center";

                subheadlineLines.forEach((line, index) => {
                    textCanvasContext.fillText(line, 150, subheadlineStartY + (lineHeightSubheadline * index));
                });

                moveQRCodeDownPixel = subheadlineStartY + (subheadlineLines.length * lineHeightSubheadline) + 20;
            }

            const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");
            textCanvasContext.drawImage(qrCodeCanvasContext, 40, moveQRCodeDownPixel, 220, 220);
            textCanvas.toBlob((blob) => {
                const file = new File([blob], downloadFilename + '.png', { type: 'image/png' });
                setImage(file);
            }, "image/png");
        };
    };

    /**Comment Out: Print not used in the Moment
    const PrintPng = () => {
        const div = document.querySelector('.print-content');

        const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");
        const img = qrCodeCanvasContext.toDataURL({
            format: 'jpeg',
            quality: 0.75
        });
        const singleImg = `<img src=${img} class='image-content' />`;
        div.innerHTML = singleImg;

        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=1000000,height=10000');
        printWindow.document.write(div.innerHTML);
        printWindow.document.close();
        printWindow.onload = function () {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
        return true;
    };
    */

    return (
        <>
            <ErrorPopup
                error={errorPopup}
                onClose={() => setErrorPopup(null)}
                onManualCopyConfirmed={() => afterSaveFunction(globalConst.saveType.CLIPBOARD)}
            />
            <div className="op__outerbox_grey op__margin_standard_top_bottom">
                <div className={styles.innerbox}>
                    <div className="noScreen print-content"></div>
                    <strong>{headline}</strong>
                    <p className="op__margin_standard_top_bottom text_small">{subheadline}</p>
                    <div className={styles.zigzagbox}>
                        <div className="op__margin_standard op__overflowwrap_breakword">
                            <div className="op__flex_center-center op__margin_standard_top_bottom">
                                <div className={styles.icondiv}>
                                    <img src={`/images/icon-${headimage}.svg`} className={styles.icon}></img>
                                </div>
                                <h3 className="op__overflowwrap_breakword text_xlarge" >{downloadHeadline}</h3>

                            </div>
                            {downloadSubHeadline && (
                                <>
                                    <p className="op__margin_standard_top_bottom">{downloadSubHeadline}</p>
                                </>
                            )}
                            <QRCodeCanvas
                                value={qrCodeString}
                                size={600}
                                bgColor={"#ffffff"}
                                fgColor={"#000000"}
                                level={"M"}
                                id="qrCodeCanvas"
                                style={{ display: "none" }}
                                imageSettings={
                                    {
                                        src: `/images/icon-${headimage}.svg`,
                                        width: 120,
                                        height: 120,
                                        excavate: true
                                    }
                                }
                            />
                        </div>
                    </div>
                    <div className={styles.buttonbox}>
                        <Button
                            onClick={copiedAsText}
                            type={saved ? 'secondary' : 'primary'}
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '10px', marginBottom: '10px' }}
                        >
                            {
                                (savedAs?.includes(globalConst.saveType.CLIPBOARD))
                                    ?
                                    <CircleCheck stroke={'#29b0cc'} strokeWidth={'3'} width={30} />
                                    :
                                    <Copy stroke={saved ? '#29b0cc' : '#fff'} strokeWidth={'3'} width={30} />
                            }
                            <div>
                                {
                                    (showCodeStringCopied)
                                        ?
                                        <span className="op__font-op-grey-dark op__font-op-bold">{t("generateqrcode.copycode.successfull")}</span>
                                        :
                                        t("generateqrcode.copycode.text")
                                }
                                <br /><p className={styles.hint}>{t("generateqrcode.copycode.additionalHint")}</p>
                            </div>
                        </Button>

                        <Button
                            onClick={downloadPdf}
                            type={saved ? 'secondary' : 'primary'}
                            style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px', marginBottom: '10px' }}
                        >
                            <div style={{ alignSelf: 'center' }}>
                                {
                                    (savedAs?.includes(globalConst.saveType.PDF))
                                        ?
                                        <CircleCheck stroke={'#29b0cc'} strokeWidth={'3'} width={20} />
                                        :
                                        <File stroke={saved ? '#29b0cc' : '#fff'} strokeWidth={'3'} width={20} />
                                }
                            </div>
                            {
                                t("generateqrcode.saveas.pdf")
                            }
                        </Button>
                        <canvas
                            id="canvas"
                            width="300"
                            height="400"
                            style={{ display: "none" }}
                        />
                        {(
                            <Button
                                onClick={downloadImage}
                                type={saved ? 'secondary' : 'primary'}
                                style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px' }}
                            >
                                <div style={{ alignSelf: 'center' }}>
                                    {
                                        (savedAs?.includes(globalConst.saveType.IMAGE))
                                            ?
                                            <CircleCheck stroke={'#29b0cc'} strokeWidth={'3'} width={20} />
                                            :
                                            <FileImage stroke={saved ? '#29b0cc' : '#fff'} strokeWidth={'3'} width={20} />
                                    }
                                </div>
                                <div>
                                    {t("generateqrcode.saveas.image")}
                                </div>
                            </Button>
                        )}
                    </div>

                </div>
            </div>
            <div>{lastActivation}</div>
        </>
    );
}

GenerateQRCode.propTypes = {
    headline: PropTypes.string.isRequired,
    qrCodeString: PropTypes.string.isRequired,
    subheadline: PropTypes.string,
    text: PropTypes.string.isRequired,
    downloadHeadline: PropTypes.string.isRequired,
    copyableTextType: PropTypes.string.isRequired,
    downloadSubHeadline: PropTypes.string,
    headimage: PropTypes.string.isRequired,
};
