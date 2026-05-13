'use client';
import { useState } from "react";
import { QRCodeCanvas } from 'qrcode.react';
import styles from '../styles/GenerateQRCode.module.css';
import PropTypes from "prop-types";
import { File, Copy, FileImage, CircleCheck } from "lucide-react";
import { useTranslation } from "next-i18next";
import { createPDF } from "@/save-pdf";
import Button from './Button';
import globalConst from "@/constants";

export default function GenerateQRCode(props) {
    const {
        headline,
        subheadline,
        qrCodeString,
        downloadHeadline,
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
    const [showQRCodeCopied, setShowQRCodeCopied] = useState(false);

    const givePDF = () => {
        createPDF(qrCodeString, downloadHeadline, downloadSubHeadline, downloadFilename, pdfQRtype, pdfInformation);
        afterSaveFunction(globalConst.saveType.PDF);
    };

    const copiedAsText = () => {
        navigator.clipboard.writeText(downloadHeadline + ': ' + qrCodeString);
        setShowQRCodeCopied(true);
        afterSaveFunction(globalConst.saveType.CLIPBOARD);
        setTimeout(() => {
            setShowQRCodeCopied(false);
        }, 4000);
    }

    const wordwrapAndPositionText = (context, text, x, y, lineHeight, fitWidth) => {
        let words = text.split(' ');
        let currentLine = 0;
        let idx = 1;

        //short: we go through the wordlist and measure how many words would fit into the lines
        while (words.length > 0 && idx <= words.length) {
            var str = words.slice(0, idx).join(' ');
            var wordsPixelWidth = context.measureText(str).width;

            //if this is one word too much
            if (wordsPixelWidth > fitWidth) {
                //just in case one word is very long.. otherwise it wont end
                if (idx == 1) {
                    idx = 2;
                }

                context.fillText(words.slice(0, idx - 1).join(' '), x, y + (lineHeight * currentLine));
                currentLine++;
                words = words.splice(idx - 1);
                idx = 1;
            } else {
                //means one more word might fit into the line
                idx++;
            }
        }

        //still word(s) left
        if (words.length > 0) {
            context.fillText(words.join(' '), x, y + (lineHeight * currentLine));
        }
    };

    const DownloadAsPng = () => {
        const textCanvas = document.getElementById("canvas");
        const textCanvasContext = textCanvas.getContext("2d");
        let moveQRCodeDownPixel = 80;
        textCanvasContext.fillStyle = "white";
        textCanvasContext.fillRect(0, 0, textCanvas.width, textCanvas.height);
        textCanvasContext.fillStyle = "#000";
        textCanvasContext.lineStyle = "#000";
        textCanvasContext.font = "18px sans-serif";
        textCanvasContext.lineWidth = 2;
        textCanvasContext.textAlign = "center";
        textCanvasContext.fillText(downloadHeadline, 150, 50);

        if (downloadSubHeadline?.length > 0) {
            textCanvasContext.fillStyle = "#000";
            textCanvasContext.lineStyle = "#000";
            textCanvasContext.font = "14px sans-serif";
            textCanvasContext.lineWidth = 1;
            textCanvasContext.textAlign = "center";
            wordwrapAndPositionText(textCanvasContext, downloadSubHeadline, 150, 80, 20, 300);
            moveQRCodeDownPixel = 150;
            //textCanvasContext.fillText(downloadSubHeadline, 100, 80);
        }
        const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");

        textCanvasContext.drawImage(qrCodeCanvasContext, 40, moveQRCodeDownPixel, 220, 220);

        const link = document.createElement('a');
        link.download = downloadFilename + ".png";
        link.href = textCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        link.click();
        afterSaveFunction(globalConst.saveType.IMAGE);
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
                                size={300}
                                bgColor={"#ffffff"}
                                fgColor={"#000000"}
                                level={"Q"}
                                id="qrCodeCanvas"
                                style={{ display: "none" }}
                                imageSettings={
                                    {
                                        src: `/images/icon-${headimage}.svg`,
                                        width: 60,
                                        height: 60,
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
                            style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px', marginBottom: '10px' }}
                        >
                            {
                                (savedAs?.includes(globalConst.saveType.CLIPBOARD))
                                    ?
                                    <CircleCheck stroke={'#29b0cc'} strokeWidth={'3'} width={30} style={{ marginTop: '20px' }} />
                                    :
                                    <Copy stroke={saved ? '#29b0cc' : '#fff'} strokeWidth={'3'} width={30} style={{ marginTop: '20px' }} />
                            }
                            <div>
                                {
                                    (showQRCodeCopied)
                                        ?
                                        <span className="op__font-op-grey-dark op__font-op-bold">{t("generateqrcode.copycode.successfull")}</span>
                                        :
                                        t("generateqrcode.copycode.text")
                                }
                                <br /><p className={styles.hint}>{t("generateqrcode.copycode.additionalHint")}</p>
                            </div>
                        </Button>

                        <Button
                            onClick={givePDF}
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
                        <Button
                            onClick={DownloadAsPng}
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

                    </div>

                </div>
            </div>

        </>
    );
}

GenerateQRCode.propTypes = {
    headline: PropTypes.string.isRequired,
    qrCodeString: PropTypes.string.isRequired,
    subheadline: PropTypes.string,
    text: PropTypes.string.isRequired,
    downloadHeadline: PropTypes.string.isRequired,
    downloadSubHeadline: PropTypes.string,
    headimage: PropTypes.string.isRequired,
};
