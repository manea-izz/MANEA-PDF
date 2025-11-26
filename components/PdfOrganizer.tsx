import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileUpload } from './FileUpload';
import { Spinner } from './Spinner';
import { DownloadIcon, ResetIcon, SaveIcon, TrashIcon, RotateIcon } from './icons';

// PDF.js worker setup
(window as any).pdfjsWorker = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

interface PageInfo {
  id: string;
  pdf: any; // PDFDocumentProxy
  pageNumber: number;
  rotation: number;
  originalFileIndex: number;
}

const PageThumbnail: React.FC<{ pageInfo: PageInfo; onDelete: () => void; onRotate: () => void; }> = ({ pageInfo, onDelete, onRotate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pdf, pageNumber, rotation } = pageInfo;

  useEffect(() => {
    let isMounted = true;
    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d');
        if (!context) return;
        
        const rotatedViewport = page.getViewport({ scale: 0.4, rotation });
        canvas.height = rotatedViewport.height;
        canvas.width = rotatedViewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: rotatedViewport,
        };
        await page.render(renderContext).promise;
      } catch (error) {
        console.error(`Failed to render page ${pageNumber}`, error);
      }
    };

    renderPage();
    return () => { isMounted = false; };
  }, [pdf, pageNumber, rotation]);

  return (
    <div className="relative group border-2 border-slate-200 p-1 rounded-md bg-white shadow-sm flex flex-col items-center">
      <div className="bg-slate-100 rounded-sm overflow-hidden mb-2">
        <canvas ref={canvasRef} className="w-full h-auto" />
      </div>
      <p className="text-xs font-semibold text-slate-600 mb-1">صفحة {pageNumber}</p>
       <div className="absolute top-0 right-0 m-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete} className="p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600" title="حذف الصفحة"><TrashIcon /></button>
        <button onClick={onRotate} className="p-1 bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600" title="تدوير الصفحة"><RotateIcon /></button>
      </div>
    </div>
  );
};

export const PdfOrganizer: React.FC = () => {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setIsLoading(true);
    setError(null);
    setPdfUrl(null);
    setPages([]);
    
    try {
      const newPages: PageInfo[] = [];
      for (const [fileIndex, file] of selectedFiles.entries()) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          newPages.push({
            id: `${file.name}-${i}-${Date.now()}`,
            pdf,
            pageNumber: i,
            rotation: 0,
            originalFileIndex: fileIndex,
          });
        }
      }
      setPages(newPages);
    } catch (e) {
      console.error(e);
      setError("حدث خطأ أثناء معالجة ملفات PDF. تأكد من أنها ملفات صالحة.");
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleSave = async () => {
    if(pages.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
        const { PDFDocument } = (window as any).PDFLib;
        const mergedPdfDoc = await PDFDocument.create();

        const loadedOriginalDocs: any[] = [];
        const originalFiles = pages.reduce((acc, page) => {
            if (!acc.some(p => p.originalFileIndex === page.originalFileIndex)) {
                acc.push(page);
            }
            return acc;
        }, [] as PageInfo[]).sort((a, b) => a.originalFileIndex - b.originalFileIndex);

        for (const pageInfo of originalFiles) {
            const arrayBuffer = await pageInfo.pdf.getData();
            loadedOriginalDocs[pageInfo.originalFileIndex] = await PDFDocument.load(arrayBuffer);
        }

        for (const pageInfo of pages) {
            const sourceDoc = loadedOriginalDocs[pageInfo.originalFileIndex];
            const [copiedPage] = await mergedPdfDoc.copyPages(sourceDoc, [pageInfo.pageNumber - 1]);
            copiedPage.setRotation((window as any).PDFLib.degrees(pageInfo.rotation));
            mergedPdfDoc.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
    } catch(e) {
        console.error(e);
        setError("حدث خطأ أثناء حفظ الملف الجديد.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleReset = () => {
      if(pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPages([]);
      setError(null);
      setPdfUrl(null);
  };
  
  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragEnter = (id: string) => {
      if(draggedId === null || draggedId === id) return;
      const draggedIndex = pages.findIndex(p => p.id === draggedId);
      const targetIndex = pages.findIndex(p => p.id === id);
      
      const newPages = [...pages];
      const [draggedItem] = newPages.splice(draggedIndex, 1);
      newPages.splice(targetIndex, 0, draggedItem);
      setPages(newPages);
  };
  const handleDragEnd = () => setDraggedId(null);
  const handleDeletePage = (id: string) => setPages(p => p.filter(page => page.id !== id));
  const handleRotatePage = (id: string) => setPages(p => p.map(page => page.id === id ? {...page, rotation: (page.rotation + 90) % 360} : page));

  if (pdfUrl) {
    return (
        <div className="text-center flex flex-col items-center justify-center h-64">
            <h2 className="text-2xl font-semibold text-green-600 mb-4">تم تنظيم الملف بنجاح!</h2>
            <a href={pdfUrl} download={`organized-${Date.now()}.pdf`} className="inline-flex items-center gap-2 bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition-colors duration-300 text-lg shadow-md">
                <DownloadIcon /> تحميل ملف PDF
            </a>
            <button onClick={handleReset} className="inline-flex items-center gap-2 mt-4 text-slate-600 hover:text-slate-800 font-semibold">
                <ResetIcon /> تنظيم ملف جديد
            </button>
        </div>
    );
  }

  return (
    <div>
      <FileUpload onFilesSelected={handleFilesSelected} disabled={isLoading || isSaving} descriptionText="ملفات PDF فقط" acceptTypes="application/pdf" />
      
      {isLoading && <div className="mt-6 flex items-center justify-center gap-2 text-slate-600"><Spinner className="h-5 w-5 text-blue-600"/><span>جاري معالجة الصفحات...</span></div>}
      
      {pages.length > 0 && (
          <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2">اسحب الصفحات لإعادة ترتيبها ({pages.length} صفحة)</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-h-96 overflow-y-auto p-2 bg-slate-100 rounded-lg">
                  {pages.map(pageInfo => (
                      <div key={pageInfo.id} draggable onDragStart={() => handleDragStart(pageInfo.id)} onDragEnter={() => handleDragEnter(pageInfo.id)} onDragEnd={handleDragEnd} onDragOver={e => e.preventDefault()} className={`cursor-grab active:cursor-grabbing transition-opacity ${draggedId === pageInfo.id ? 'opacity-50' : ''}`}>
                          <PageThumbnail pageInfo={pageInfo} onDelete={() => handleDeletePage(pageInfo.id)} onRotate={() => handleRotatePage(pageInfo.id)} />
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {error && <p className="mt-4 text-red-500 text-center">{error}</p>}

      <div className="mt-8 pt-6 border-t border-slate-200">
        <button onClick={handleSave} disabled={pages.length === 0 || isLoading || isSaving} className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 text-lg shadow-md disabled:shadow-none">
            {isSaving ? (<><Spinner className="h-6 w-6 text-white"/><span>جاري الحفظ...</span></>) : (<><SaveIcon /><span>حفظ PDF المنظم</span></>)}
        </button>
      </div>
    </div>
  );
};
