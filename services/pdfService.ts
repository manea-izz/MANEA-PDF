// This tells TypeScript that these libraries are available globally, loaded from the CDN.
// We access them directly as they are on the window object.

/**
 * Renders HTML content to a canvas, converts it to a JPG image, and embeds it into a new page in the PDF document.
 * @param htmlContent The HTML string to render.
 * @param pdfDoc The pdf-lib PDFDocument instance to add the page to.
 */
async function embedHtmlAsImage(htmlContent: string, pdfDoc: any): Promise<void> {
  const { rgb } = (window as any).PDFLib;
  const container = document.createElement('div');

  // Style the container to resemble a document page for rendering
  container.style.position = 'absolute';
  container.style.left = '-9999px'; // Position off-screen to avoid flicker
  container.style.width = '8.5in';
  container.style.padding = '1in';
  container.style.backgroundColor = 'white';
  container.style.boxSizing = 'border-box';
  container.style.direction = 'ltr'; // LTR for consistent office doc rendering

  // Add basic styles for the content
  const style = document.createElement('style');
  style.innerHTML = `
    body { font-family: sans-serif; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 4px; text-align: left; word-wrap: break-word; }
    th { background-color: #f2f2f2; }
    p { margin: 0 0 1em 0; line-height: 1.4; }
    h1, h2, h3, h4, h5, h6 { margin: 1.2em 0 0.8em 0; }
  `;
  container.prepend(style);
  container.innerHTML += htmlContent;

  document.body.appendChild(container);

  try {
    const canvas = await (window as any).html2canvas(container, {
      scale: 2, // Use higher scale for better image quality
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    });

    // Convert canvas to JPG and embed it into the PDF
    const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const jpgBytes = await fetch(jpgDataUrl).then(res => res.arrayBuffer());
    const jpgImage = await pdfDoc.embedJpg(jpgBytes);

    // Add a new page and draw the image, scaled to fit
    const page = pdfDoc.addPage();
    const pageDimensions = page.getSize();
    const imageDimensions = jpgImage.scale(1);

    const scale = Math.min(pageDimensions.width / imageDimensions.width, pageDimensions.height / imageDimensions.height);
    const scaledWidth = imageDimensions.width * scale;
    const scaledHeight = imageDimensions.height * scale;

    page.drawImage(jpgImage, {
      x: (pageDimensions.width - scaledWidth) / 2,
      y: (pageDimensions.height - scaledHeight) / 2,
      width: scaledWidth,
      height: scaledHeight,
    });
  } catch (error) {
    console.error("Error converting HTML to canvas:", error);
    const page = pdfDoc.addPage();
    page.drawText(`Failed to render Office document`, {
      x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2),
    });
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Merges an array of files (images, PDFs, and Office docs) into a single PDF document.
 * @param files An array of File objects to merge, in the desired order.
 * @param onProgress A callback function that receives the name of the file currently being processed.
 * @returns A Promise that resolves with a Uint8Array of the merged PDF.
 */
export const mergeFilesToPdf = async (files: File[], onProgress?: (fileName: string) => void): Promise<Uint8Array> => {
  const { PDFDocument, rgb } = (window as any).PDFLib;
  const mergedPdfDoc = await PDFDocument.create();

  for (const file of files) {
    onProgress?.(file.name);
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
      const page = mergedPdfDoc.addPage();
      const imageBytes = await file.arrayBuffer();
      let image;
      if (file.type === 'image/jpeg') {
        image = await mergedPdfDoc.embedJpg(imageBytes);
      } else if (file.type === 'image/png') {
        image = await mergedPdfDoc.embedPng(imageBytes);
      } else {
        page.drawText(`Unsupported image: ${file.name}`, { x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2) });
        continue;
      }

      const pageDimensions = page.getSize();
      const imageDimensions = image.scale(1);
      const scale = Math.min(pageDimensions.width / imageDimensions.width, pageDimensions.height / imageDimensions.height);
      page.drawImage(image, {
        x: (pageDimensions.width - imageDimensions.width * scale) / 2,
        y: (pageDimensions.height - imageDimensions.height * scale) / 2,
        width: imageDimensions.width * scale,
        height: imageDimensions.height * scale,
      });

    } else if (fileType === 'application/pdf') {
      try {
        const pdfBytes = await file.arrayBuffer();
        const donorPdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const copiedPageIndices = donorPdfDoc.getPageIndices();
        const copiedPages = await mergedPdfDoc.copyPages(donorPdfDoc, copiedPageIndices);
        copiedPages.forEach((page) => mergedPdfDoc.addPage(page));
      } catch (e) {
         console.error(`Could not process PDF file: ${file.name}`, e);
         const page = mergedPdfDoc.addPage();
         page.drawText(`Could not load PDF: ${file.name}`, { x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2) });
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
          await embedHtmlAsImage(result.value, mergedPdfDoc);
      } catch (e) {
          console.error(`Could not process Word file: ${file.name}`, e);
          const page = mergedPdfDoc.addPage();
          page.drawText(`Could not load Word file: ${file.name}`, { x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2) });
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx')) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = (window as any).XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const html = (window as any).XLSX.utils.sheet_to_html(worksheet);
            await embedHtmlAsImage(html, mergedPdfDoc);
        } catch (e) {
            console.error(`Could not process Excel file: ${file.name}`, e);
            const page = mergedPdfDoc.addPage();
            page.drawText(`Could not load Excel file: ${file.name}`, { x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2) });
        }
    } else {
        const page = mergedPdfDoc.addPage();
        page.drawText(`Unsupported file: ${file.name}`, { x: 50, y: page.getHeight() / 2, size: 24, color: rgb(0.8, 0.2, 0.2) });
    }
  }

  return await mergedPdfDoc.save();
};