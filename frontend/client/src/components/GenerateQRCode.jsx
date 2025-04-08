'use client';
import { QRCodeCanvas } from 'qrcode.react';
import styles from '../styles/GenerateQRCode.module.css';
import NextImage from 'next/image';
import Button from './Button';
import PropTypes from "prop-types";

export default function GenerateQRCode(props) {
    const { headline, subheadline, text, downloadHeadline, downloadSubHeadline, headimage, saveButtonText, afterSaveFunction } = props;

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
        link.download = downloadHeadline + ".png";
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
            <div className="op__outerbox_grey">
                <div className={styles.innerbox}>
                    <div className="noScreen print-content"></div>
                    <strong>{headline}</strong>
                    <p>{subheadline}</p>
                    <div className={styles.zigzagbox}>
                        <NextImage
                            src={`/images/generated-${headimage}.png`}
                            height={75}
                            width={300}
                            style={{ margin: "1rem auto" }}
                            id="headImage"
                        />
                        <h3>{downloadHeadline}</h3>
                        {downloadSubHeadline && (
                            <>
                                <p>{downloadSubHeadline}</p>
                            </>
                        )}
                        <QRCodeCanvas
                            value={text}
                            size={300}
                            bgColor={"#ffffff"}
                            fgColor={"#000000"}
                            level={"Q"}
                            id="qrCodeCanvas"
                            style={{ margin: "1rem auto" }}
                        />
                        <canvas
                            id="canvas"
                            width="300"
                            height="400"
                            style={{ display: "none" }}
                        />
                    </div>
                    <div className={styles.buttonbox}>

                        <Button
                            onClickAction={DownloadAsPng}
                            type="primary_light"
                            text={saveButtonText}
                            style={{ display: 'block', width: '100%' }}
                        />

                    </div>
                </div>
            </div>
        </>
    );
}

GenerateQRCode.propTypes = {
    headline: PropTypes.string.isRequired,
    subheadline: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    downloadHeadline: PropTypes.string.isRequired,
    downloadSubHeadline: PropTypes.string,
    headimage: PropTypes.string.isRequired,
    saveButtonText: PropTypes.string.isRequired,
};