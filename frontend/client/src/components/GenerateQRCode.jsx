'use client';
import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import globalConst from "@/constants";
import styles from '../styles/GenerateQRCode.module.css';
import btn_styles from '../styles/Button.module.css';
import PropTypes from "prop-types";
import { Download } from "lucide-react";
import { useTranslation } from "next-i18next";
import { createPDF } from "@/save-pdf";

export default function GenerateQRCode(props) {
    const { headline, subheadline, qrCodeString, downloadHeadline, downloadSubHeadline, downloadFilename, headimage, saveButtonText, pdfQRtype, afterSaveFunction, saved, pdfInformation } = props;
    const { t } = useTranslation();

    const givePDF = () => {
        createPDF(qrCodeString, downloadHeadline, downloadSubHeadline, downloadFilename, pdfQRtype, pdfInformation);
        afterSaveFunction();
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
        afterSaveFunction();
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
            <div className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <div className={styles.innerbox}>
                    <div className="noScreen print-content"></div>
                    <strong>{headline}</strong>
                    <p className="op__margin_standard_top_bottom text_small">{subheadline}</p>
                    <div className={styles.zigzagbox}>
                        <h3 className="op__margin_standard_top_bottom text_xlarge">{downloadHeadline}</h3>
                        {downloadSubHeadline && (
                            <>
                                <p>{downloadSubHeadline}</p>
                            </>
                        )}
                        <QRCodeCanvas
                            value={qrCodeString}
                            size={300}
                            bgColor={"#ffffff"}
                            fgColor={"#000000"}
                            level={"Q"}
                            id="qrCodeCanvas"
                            style={{ margin: "1rem auto", fontweight: "bold" }}
                            imageSettings={
                                {
                                    src: `/images/icon-${headimage}.svg`,
                                    width: 90,
                                    height: 90,
                                    excavate: true
                                }
                            }
                        />
                        <canvas
                            id="canvas"
                            width="300"
                            height="400"
                            style={{ display: "none" }}
                        />
                    </div>
                    <div className={styles.buttonbox}>
                        <button
                            onClick={givePDF}
                            className={saved ? `${btn_styles.secondary} ${btn_styles.btn}` : `${btn_styles.primary} ${btn_styles.btn}`}
                            style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px' }} >
                            <div style={{ alignSelf: 'center' }}>
                                {
                                    (saved)
                                        ?
                                        <Download stroke={'#29b0cc'} strokeWidth={'3'} width={20} />
                                        :
                                        <Download stroke={'white'} strokeWidth={'3'} width={20} />
                                }
                            </div>
                            {saveButtonText}
                        </button>
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
    saveButtonText: PropTypes.string.isRequired,
};
