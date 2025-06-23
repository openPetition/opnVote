'use client';
import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import globalConst from "@/constants";
import styles from '../styles/GenerateQRCode.module.css';
import btn_styles from '../styles/Button.module.css';
import PropTypes from "prop-types";
import { useTranslation } from "next-i18next";
export default function GenerateQRCode(props) {
    const { headline, subheadline, qrCodeString, downloadHeadline, downloadSubHeadline, headimage, saveButtonText, pdfQRtype, afterSaveFunction, pdfInformation } = props;
    const { t } = useTranslation();
    const [isGenerating, setIsGenerating] = useState(false);

    const pdfContentType = {
        'TEXT': 'text',
        'LINE': 'line',
        'IMAGE': 'image'
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

    // header can have fixed positions
    const standardHeaderPDFContent = (page, font, boldFont) => {
        return [
            {
                type: pdfContentType.TEXT,
                text: t("pdf.created", { CREATIONDATE: new Date(), interpolation: { escapeValue: false } }),
                yPos: page.getHeight() - 50,
                font: font,
                fontSize: 10,
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.createdwith") + window.navigator.userAgent.slice(0, 42) + '..',
                yPos: page.getHeight() - 66,
                font: font,
                fontSize: 10,
            },
            {
                type: pdfContentType.TEXT,
                text: downloadHeadline, //e.g. Wahlschein
                fontSize: 26,
                yPos: page.getHeight() - 100,
                font: boldFont
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.keepsecrethint"),
                yPos: page.getHeight() - 120,
                font: font,
                fontSize: 10
            },
            {
                type: pdfContentType.LINE,
                path: 'M 0,0 L520,0',
                moveX: 40,
                yPos: 670
            },
        ];
    }

    const electionKeyPDFcontent = (font, boldFont, qrImage) => {
        return [
            {
                type: pdfContentType.IMAGE,
                image: qrImage,
                start: 650,
                options: {
                    x: 200,
                    //yPos: 450,
                    width: 200,
                    height: 200
                }
            },
            {
                type: pdfContentType.LINE,
                marginTop: 20,
                path: 'M 0,0 L520,0',
                moveX: 40,
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.votingkey.additionalinfo.votingkeyexplained.1"),
                marginTop: 20,
                fontSize: 10,
                lineHeight: 12,
                maxWidth: 500,
                wordBreaks: [" "],
                font: font
            },
            {
                type: pdfContentType.TEXT,
                marginTop: 10,
                text: t("pdf.votingkey.additionalinfo.votingkeyexplained.2"),
                fontSize: 10,
                lineHeight: 12,
                maxWidth: 500,
                lineHeight: 12,
                wordBreaks: [" "],
                font: font
            },
            {
                type: pdfContentType.TEXT,
                marginTop: 10,
                text: t("pdf.votingkey.additionalinfo.electionoverviewlink"),
                fontSize: 10,
                lineHeight: 12,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                marginTop: 10,
                text: "www.openpetition.de/opn-vote",
                xPos: 200,
                color: rgb(0, 0, 1),
                fontSize: 10,
                font: font,
                link: "https://www.openpetition.de/opn-vote",
            },
        ];
    }

    const electionPermitPDFcontent = (font, boldFont, qrImage, pdfInformation) => {
        return [
            {
                type: pdfContentType.TEXT,
                text: t("pdf.register.entitles"),
                fontSize: 10,
                start: 650,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                text: downloadSubHeadline,
                fontSize: 14,
                maxWidth: 500,
                lineHeight: 14,
                wordBreaks: [" "],
                marginTop: 10,
                font: boldFont
            },
            {
                type: pdfContentType.LINE,
                marginTop: 20,
                path: 'M 0,0 L520,0',
                moveX: 40,
            },
            {
                type: pdfContentType.TEXT,
                fontSize: 10,
                text: t("pdf.electionduration"),
                marginTop: 20,
                noPush: true,
                font: font
            },
            {
                text: t("pdf.electionfromto", { STARTDATE: pdfInformation.STARTDATE, ENDDATE: pdfInformation.ENDDATE, interpolation: { escapeValue: false } }),
                xPos: 200,
                type: pdfContentType.TEXT,
                fontSize: 10,
                marginTop: 1,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.electionlink"),
                fontSize: 10,
                marginTop: 10,
                noPush: true,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                fontSize: 10,
                text: pdfInformation.ELECTION_URL,
                xPos: 200,
                color: rgb(0, 0, 1),
                marginTop: 1,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.register.electionpermit.digital"),
                fontSize: 10,
                marginTop: 10,
                noPush: true,
                font: font
            },
            {
                type: pdfContentType.IMAGE,
                image: qrImage,
                marginTop: 1,
                options: {
                    x: 200,
                    width: 200,
                    height: 200
                }
            },
            {
                type: pdfContentType.LINE,
                marginTop: 20,
                path: 'M 0,0 L520,0',
                moveX: 40,
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.register.registerexplained.1"),
                wordBreaks: [" "],
                fontSize: 10,
                marginTop: 20,
                maxWidth: 500,
                lineHeight: 12,
                font: font
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.register.registerexplained.2"),
                wordBreaks: [" "],
                fontSize: 10,
                marginTop: 20,
                maxWidth: 500,
                lineHeight: 12,
                font: font
            },
            {
                type: pdfContentType.LINE,
                marginTop: 10,
                path: 'M 0,0 L520,0',
                moveX: 40,
            },
            {
                type: pdfContentType.TEXT,
                text: t("pdf.register.lawhint"),
                fontSize: 8,
                marginTop: 20,
                maxWidth: 500,
                lineHeight: 10,
                font: font
            },
        ]
    }

    const createPDF = async () => {
        setIsGenerating(true);

        try {
            const qrCodeCanvasContext = document.getElementById("qrCodeCanvas");
            const qrDataUrl = qrCodeCanvasContext.toDataURL("image/png").replace("image/png", "image/octet-stream");
            const logoUrl = 'images/opnvote-logo-big.png';
            const pngImageBytes = await fetch(logoUrl).then((res) => res.arrayBuffer());
            const pdfDoc = await PDFDocument.create();
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            const pngDims = pngImage.scale(1);
            const page = pdfDoc.addPage([600, 800]);

            // Convert data URL to array buffer for embedding
            // Remove the data URL prefix to get just the base64 data
            const base64Data = qrDataUrl.split(",")[1]
            if (!base64Data) {
                throw new Error("Invalid QR code data URL format")
            }

            // Convert base64 to binary
            const binaryData = atob(base64Data)
            const bytes = new Uint8Array(binaryData.length)
            for (let i = 0; i < binaryData.length; i++) {
                bytes[i] = binaryData.charCodeAt(i)
            }

            // Embed the QR code image
            const qrImage = await pdfDoc.embedPng(bytes.buffer)
            // Get the dimensions of the QR code
            const qrDims = qrImage.scale(1);

            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            let pdfHeaderContent;
            let pdfAdditionalContent;
            pdfHeaderContent = await standardHeaderPDFContent(page, font, boldFont);

            switch (pdfQRtype) {
                case globalConst.pdfType.VOTINGKEY:
                    pdfAdditionalContent = await electionKeyPDFcontent(font, boldFont, qrImage);
                    break;
                case globalConst.pdfType.ELECTIONPERMIT:
                    pdfAdditionalContent = await electionPermitPDFcontent(font, boldFont, qrImage, pdfInformation);
                    break;
            }

            const pdfContent = pdfHeaderContent.concat(pdfAdditionalContent);

            const getPushDownHeight = (options, font) => {
                let factor = 1;
                const width = font.widthOfTextAtSize(options.text, options.size);
                const height = font.heightAtSize(options.size);

                if (options.maxWidth) {
                    factor = Math.ceil(width / options.maxWidth);
                }
                let pushDown = factor * height;

                return pushDown;
            }

            let yPos = 0;
            for (const pdfContentLine of pdfContent) {

                if (!pdfContentLine.marginTop) {
                    yPos = pdfContentLine.yPos;
                }

                if (pdfContentLine.marginTop) {
                    yPos = yPos - Number(pdfContentLine.marginTop);
                }

                if (pdfContentLine.start) {
                    yPos = pdfContentLine.start;
                }

                if (pdfContentLine.type === pdfContentType.TEXT) {

                    // for link
                    if (pdfContentLine.link) {
                        const textWidth = font.widthOfTextAtSize(pdfContentLine.text, pdfContentLine.fontSize);
                        const textHeight = font.heightAtSize(pdfContentLine.fontSize);
                        const linkAnnotation = page.doc.context.obj({
                            Type: "Annot",
                            Subtype: "Link",
                            Rect: [pdfContentLine.xPos ? pdfContentLine.xPos : 50, yPos - 2, pdfContentLine.xPos + textWidth, yPos + textHeight],
                            Border: [0, 0, 0],
                            A: {
                                Type: "Action",
                                S: "URI",
                                URI: pdfContentLine.link,
                            },
                        })

                        // Add annotation to page
                        const annotations = page.node.Annots()
                        if (annotations) {
                            annotations.push(linkAnnotation)
                        } else {
                            page.node.set("Annots", page.doc.context.obj([linkAnnotation]))
                        }
                    }

                    let options = {
                        x: pdfContentLine.xPos ? pdfContentLine.xPos : 50,
                        y: yPos,
                        size: pdfContentLine.fontSize ? pdfContentLine.fontSize : 12,
                        font: pdfContentLine.font ? pdfContentLine.font : font,
                        text: pdfContentLine.text
                    };

                    if (pdfContentLine.maxWidth) { options.maxWidth = pdfContentLine.maxWidth };
                    if (pdfContentLine.lineHeight) { options.lineHeight = pdfContentLine.lineHeight };
                    if (pdfContentLine.wordBreaks) { options.wordBreaks = pdfContentLine.wordBreaks };
                    if (pdfContentLine.color) { options.color = pdfContentLine.color };
                    const text = page.drawText(pdfContentLine.text, options);

                    if (!pdfContentLine.noPush) {
                        yPos = yPos - getPushDownHeight(options, font);
                    }
                }

                if (pdfContentLine.type === pdfContentType.LINE) {
                    page.moveTo(pdfContentLine.moveX, yPos);
                    page.drawSvgPath(pdfContentLine.path, { borderColor: rgb(0, 0, 0), borderWidth: 1 });
                }

                if (pdfContentLine.type === pdfContentType.IMAGE) {
                    // Add the QR code to the center of the page
                    yPos = yPos - pdfContentLine.options.height;
                    pdfContentLine.options.y = yPos;
                    page.drawImage(pdfContentLine.image, pdfContentLine.options)
                }
            }

            pdfDoc.setTitle(downloadHeadline)
            pdfDoc.setAuthor('opn.vote')
            pdfDoc.setCreationDate(new Date());
            pdfDoc.setSubject('QRCODE:' + qrCodeString)

            const keywordsWithData = ["QR Code", "Metadata", downloadHeadline]
            pdfDoc.setKeywords(keywordsWithData)

            page.drawImage(pngImage, {
                x: page.getWidth() - 50 - (pngDims.width / 2),
                y: page.getHeight() - 50 - (pngDims.height / 2),
                width: (pngDims.width / 2),
                height: (pngDims.height / 2),
            });

            const pdfBytes = await pdfDoc.save()
            const blob = new Blob([pdfBytes], { type: "application/pdf" })
            const url = URL.createObjectURL(blob)

            // Create a link element and trigger a download
            const link = document.createElement("a");
            link.href = url;
            link.download = downloadHeadline + '.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error("PDF creation error:", err)
        } finally {
            setIsGenerating(false)
        }
    }

    const givePDF = () => {
        createPDF();
        afterSaveFunction();
    }

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
                            className={`${btn_styles.primary} ${btn_styles.btn}`}
                            style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '10px' }} >
                            <img src={'/images/download.svg'} alt={"Download icon"} height={10} width={20} />
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
