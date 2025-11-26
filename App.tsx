import React, { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { FilePreviewCard } from './components/FilePreviewCard';
import { Spinner } from './components/Spinner';
import { mergeFilesToPdf } from './services/pdfService';
import { DownloadIcon, MergeIcon, ResetIcon, WhatsappIcon, FacebookIcon, SortAscendingIcon, SortDescendingIcon, OrganizeIcon, SparklesIcon } from './components/icons';
import { PdfOrganizer } from './components/PdfOrganizer';
import { AiChat } from './components/AiChat';

type SortCriteria = 'name' | 'size' | 'date';
type SortOrder = 'asc' | 'desc';
type ActiveTab = 'merger' | 'organizer' | 'ai';

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [firstPageFileName, setFirstPageFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [processingFileName, setProcessingFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('merger');

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(prevFiles => {
        const newFiles = selectedFiles.filter(sf => !prevFiles.some(pf => pf.name === sf.name && pf.size === sf.size));
        return [...prevFiles, ...newFiles];
    });
    setError(null);
    setPdfUrl(null);
  }, []);
  
  const sortFiles = (criteria: SortCriteria, order: SortOrder, currentFiles: File[], pinnedFileName: string | null): File[] => {
    const firstFile = pinnedFileName ? currentFiles.find(f => f.name === pinnedFileName) : null;
    const filesToSort = firstFile ? currentFiles.filter(f => f.name !== pinnedFileName) : [...currentFiles];

    filesToSort.sort((a, b) => {
        let comparison = 0;
        switch (criteria) {
            case 'size': comparison = a.size - b.size; break;
            case 'date': comparison = a.lastModified - b.lastModified; break;
            case 'name': default: comparison = a.name.localeCompare(b.name); break;
        }
        return order === 'asc' ? comparison : -comparison;
    });

    return firstFile ? [firstFile, ...filesToSort] : filesToSort;
  };

  const handleSortCriteriaChange = (criteria: SortCriteria) => {
    const newSortedFiles = sortFiles(criteria, sortOrder, files, firstPageFileName);
    setSortCriteria(criteria);
    setFiles(newSortedFiles);
  };

  const handleSortOrderChange = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const newSortedFiles = sortFiles(sortCriteria, newOrder, files, firstPageFileName);
    setSortOrder(newOrder);
    setFiles(newSortedFiles);
  };

  const handleRemoveFile = useCallback((fileName: string) => {
    setFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    if (fileName === firstPageFileName) {
      setFirstPageFileName(null);
    }
  }, [firstPageFileName]);
  
  const handleSetFirstPage = useCallback((fileName: string) => {
    if (fileName === firstPageFileName) {
        setFirstPageFileName(null);
        setFiles(currentFiles => sortFiles(sortCriteria, sortOrder, currentFiles, null));
    } else {
        setFirstPageFileName(fileName);
        setFiles(prevFiles => {
            const fileToMove = prevFiles.find(f => f.name === fileName);
            if (!fileToMove) return prevFiles;
            const remainingFiles = prevFiles.filter(f => f.name !== fileName);
            return [fileToMove, ...remainingFiles];
        });
    }
  }, [firstPageFileName, sortCriteria, sortOrder]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if(activeTab !== 'merger') return;
      const items = event.clipboardData?.files;
      if (items && items.length > 0) {
        const pastedFiles = Array.from(items).filter(
          (file) => file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.includes('word') || file.type.includes('sheet')
        );
        if (pastedFiles.length > 0) {
            event.preventDefault();
            handleFilesSelected(pastedFiles);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesSelected, activeTab]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    if (firstPageFileName && (index === 0 || files[draggedIndex].name === firstPageFileName)) return;
  
    let newFiles = [...files];
    const draggedItem = newFiles.splice(draggedIndex, 1)[0];
    newFiles.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setFiles(newFiles);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleMerge = async () => {
    if (files.length === 0) {
      setError("الرجاء اختيار ملف واحد على الأقل.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const pdfBytes = await mergeFilesToPdf(files, (fileName) => setProcessingFileName(fileName));
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
      setError("حدث خطأ غير متوقع أثناء دمج الملفات. يرجى التأكد من أن الملفات غير تالفة والمحاولة مرة أخرى.");
    } finally {
      setIsLoading(false);
      setProcessingFileName(null);
    }
  };

  const handleReset = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setFiles([]);
    setFirstPageFileName(null);
    setPdfUrl(null);
    setError(null);
    setIsLoading(false);
  };

  const getSortButtonClass = (criteria: SortCriteria) => `px-2 py-1 rounded-md transition-colors ${sortCriteria === criteria ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-200'}`;
  const getTabClass = (tab: ActiveTab) => `flex-1 py-3 px-2 text-center font-semibold transition-all duration-300 rounded-t-lg flex items-center justify-center gap-2 text-sm sm:text-base ${activeTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`;

  return (
    <div className="bg-slate-100 min-h-screen font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-slate-800">MANEA PDF</h1>
          <p className="text-slate-600 mt-2">أداتك الاحترافية لدمج وتنظيم ملفات PDF بسهولة</p>
        </header>
        
        <div className="bg-white rounded-xl shadow-lg">
          <div className="flex bg-slate-100 rounded-t-xl p-1 gap-1">
            <button onClick={() => setActiveTab('merger')} className={getTabClass('merger')}>
              <MergeIcon /> دمج الملفات
            </button>
            <button onClick={() => setActiveTab('organizer')} className={getTabClass('organizer')}>
              <OrganizeIcon /> تنظيم PDF
            </button>
            <button onClick={() => setActiveTab('ai')} className={getTabClass('ai')}>
              <SparklesIcon /> محادثة ذكية
            </button>
          </div>

          <main className="p-6 md:p-8">
            {activeTab === 'merger' && (
              pdfUrl ? (
                <div className="text-center flex flex-col items-center justify-center h-64">
                  <h2 className="text-2xl font-semibold text-green-600 mb-4">تم إنشاء الملف بنجاح!</h2>
                  <a href={pdfUrl} download={`merged-${Date.now()}.pdf`} className="inline-flex items-center gap-2 bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition-colors duration-300 text-lg shadow-md">
                    <DownloadIcon /> تحميل ملف PDF
                  </a>
                  <button onClick={handleReset} className="inline-flex items-center gap-2 mt-4 text-slate-600 hover:text-slate-800 font-semibold">
                    <ResetIcon /> البدء من جديد
                  </button>
                </div>
              ) : (
                <>
                  <FileUpload onFilesSelected={handleFilesSelected} disabled={isLoading} descriptionText="صور (PNG, JPG), PDF, Word (DOCX), Excel (XLSX)" acceptTypes="image/png, image/jpeg, application/pdf, .docx, .xlsx, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                  {files.length > 0 && (
                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3 border-b pb-2">
                        <h2 className="text-lg font-semibold text-slate-700">الملفات المحددة ({files.length})</h2>
                        <div className="flex items-center gap-1 sm:gap-2 text-sm">
                            <span className="text-slate-500 hidden sm:inline">ترتيب حسب:</span>
                            <button onClick={() => handleSortCriteriaChange('name')} className={getSortButtonClass('name')}>الاسم</button>
                            <button onClick={() => handleSortCriteriaChange('size')} className={getSortButtonClass('size')}>الحجم</button>
                            <button onClick={() => handleSortCriteriaChange('date')} className={getSortButtonClass('date')}>التاريخ</button>
                            <button onClick={handleSortOrderChange} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors" aria-label={sortOrder === 'asc' ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'} title={sortOrder === 'asc' ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'}>
                                {sortOrder === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />}
                            </button>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                          <FilePreviewCard key={`${file.name}-${file.lastModified}`} file={file} isFirstPage={file.name === firstPageFileName} isDragging={draggedIndex === index} onRemove={handleRemoveFile} onSetFirstPage={handleSetFirstPage} onDragStart={() => handleDragStart(index)} onDragEnter={() => handleDragEnter(index)} onDragEnd={handleDragEnd} isProcessing={processingFileName === file.name} />
                        ))}
                      </div>
                    </div>
                  )}
                  {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <button onClick={handleMerge} disabled={files.length === 0 || isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 text-lg shadow-md disabled:shadow-none">
                      {isLoading ? (<><Spinner className="h-6 w-6 text-white"/><span>جاري المعالجة...</span></>) : (<><MergeIcon /><span>دمج وإنشاء PDF</span></>)}
                    </button>
                  </div>
                </>
              )
            )}
            {activeTab === 'organizer' && <PdfOrganizer />}
            {activeTab === 'ai' && <AiChat />}
          </main>
        </div>
        <footer className="text-center mt-8 text-slate-500 text-sm">
            <p>تم التطوير بواسطة مانع عزالدين</p>
            <div className="flex justify-center items-center gap-4 mt-2">
                <a href="https://wa.me/967772655825" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-green-500 transition-colors" aria-label="Contact on WhatsApp"><WhatsappIcon /></a>
                <a href="https://www.facebook.com/9l7iz" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 transition-colors" aria-label="Visit Facebook profile"><FacebookIcon /></a>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default App;