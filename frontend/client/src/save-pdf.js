'use client';
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import globalConst from "@/constants";
import { t } from "i18next";

const pdfContentType = {
    'TEXT': 'text',
    'LINE': 'line',
    'IMAGE': 'image'
};

// header can have fixed positions
const standardHeaderPDFContent = (page, font, boldFont, downloadHeadline) => {
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
        {
            type: pdfContentType.TEXT,
            text: t("pdf.createdwith") + window.navigator.userAgent,
            yPos: 10,
            font: font,
            fontSize: 7,
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

const electionPermitPDFcontent = (font, boldFont, qrImage, pdfInformation, downloadSubHeadline) => {
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
    ];
};

export async function createPDF(qrCodeString, downloadHeadline, downloadSubHeadline, downloadFilename, pdfQRtype, pdfInformation) {
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

        const base64Data = qrDataUrl.split(",")[1];
        if (!base64Data) {
            throw new Error("Invalid QR code data URL format");
        }

        // Convert base64 to binary
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
        }

        // Embed the QR code image
        const qrImage = await pdfDoc.embedPng(bytes.buffer);
        // Get the dimensions of the QR code
        const qrDims = qrImage.scale(1);

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let pdfHeaderContent;
        let pdfAdditionalContent;
        pdfHeaderContent = await standardHeaderPDFContent(page, font, boldFont, downloadHeadline);

        switch (pdfQRtype) {
            case globalConst.pdfType.VOTINGKEY:
                pdfAdditionalContent = await electionKeyPDFcontent(font, boldFont, qrImage);
                break;
            case globalConst.pdfType.ELECTIONPERMIT:
                pdfAdditionalContent = await electionPermitPDFcontent(font, boldFont, qrImage, pdfInformation, downloadSubHeadline);
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
        };

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
                    });

                    // Add annotation to page
                    const annotations = page.node.Annots();
                    if (annotations) {
                        annotations.push(linkAnnotation);
                    } else {
                        page.node.set("Annots", page.doc.context.obj([linkAnnotation]));
                    }
                }
                let options = {
                    x: pdfContentLine.xPos ? pdfContentLine.xPos : 50,
                    y: yPos,
                    size: pdfContentLine.fontSize ? pdfContentLine.fontSize : 12,
                    font: pdfContentLine.font ? pdfContentLine.font : font,
                    text: pdfContentLine.text,
                    color: pdfContentLine.color ? pdfContentLine.color : rgb(62 / 255, 61 / 255, 64 / 255)
                };

                if (pdfContentLine.maxWidth) { options.maxWidth = pdfContentLine.maxWidth; };
                if (pdfContentLine.lineHeight) { options.lineHeight = pdfContentLine.lineHeight; };
                if (pdfContentLine.wordBreaks) { options.wordBreaks = pdfContentLine.wordBreaks; };
                const text = page.drawText(pdfContentLine.text, options);

                if (!pdfContentLine.noPush) {
                    yPos = yPos - getPushDownHeight(options, font);
                }
            }

            if (pdfContentLine.type === pdfContentType.LINE) {
                page.moveTo(pdfContentLine.moveX, yPos);
                page.drawSvgPath(pdfContentLine.path, { borderColor: rgb(62 / 255, 61 / 255, 64 / 255), borderWidth: 1 });
            }

            if (pdfContentLine.type === pdfContentType.IMAGE) {
                // Add the QR code to the center of the page
                yPos = yPos - pdfContentLine.options.height;
                pdfContentLine.options.y = yPos;
                page.drawImage(pdfContentLine.image, pdfContentLine.options);
            }
        }

        pdfDoc.setTitle(downloadHeadline);
        pdfDoc.setAuthor('opn.vote');
        pdfDoc.setCreationDate(new Date());
        pdfDoc.setSubject('QRCODE:' + qrCodeString);

        const keywordsWithData = ["QR Code", "Metadata", downloadHeadline];
        pdfDoc.setKeywords(keywordsWithData);

        page.drawImage(pngImage, {
            x: page.getWidth() - 50 - (pngDims.width / 2),
            y: page.getHeight() - 50 - (pngDims.height / 2),
            width: (pngDims.width / 2),
            height: (pngDims.height / 2),
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);



        // Create a link element and trigger a download
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadFilename + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("PDF creation error:", err);
    }
};