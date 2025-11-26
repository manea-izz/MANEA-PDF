import React from 'react';
// FIX: Import Spinner from its own component file instead of from icons.
import { Spinner } from './Spinner';
import { FileIcon, ImageIcon, PdfIcon, RemoveIcon, PinIcon, PinFilledIcon, WordIcon, ExcelIcon, DragHandleIcon } from './icons';

interface FilePreviewCardProps {
  file: File;
  onRemove: (fileName: string) => void;
  isFirstPage: boolean;
  onSetFirstPage: (fileName: string) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  isProcessing?: boolean;
}

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('ar-EG', {
        year: '2-digit',
        month: 'short',
        day: 'numeric'
    });
};

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ 
    file, 
    onRemove, 
    isFirstPage, 
    onSetFirstPage,
    isDragging,
    onDragStart,
    onDragEnter,
    onDragEnd,
    isProcessing = false
}) => {
  const getFileIcon = () => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
      return <ImageIcon />;
    }
    if (fileType === 'application/pdf') {
      return <PdfIcon />;
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      return <WordIcon />;
    }
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx')) {
      return <ExcelIcon />;
    }
    return <FileIcon />;
  };

  const cardClasses = `flex items-center p-3 bg-slate-50 rounded-lg border shadow-sm transition-all duration-200 ${
    isFirstPage ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
  } ${isDragging ? 'opacity-50' : ''}`;

  return (
    <div 
      className={cardClasses}
      draggable={!isFirstPage && !isProcessing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
    >
      {!isFirstPage && !isProcessing && <DragHandleIcon />}
      <div className={`flex-shrink-0 text-slate-500 ${!isFirstPage && !isProcessing ? 'ml-2' : ''}`}>{getFileIcon()}</div>
      <div className="flex-grow min-w-0 mx-3">
        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
        <p className="text-xs text-slate-500 flex items-center">
          <span>{formatBytes(file.size)}</span>
          <span className="mx-1.5" aria-hidden="true">•</span>
          <span>{formatDate(file.lastModified)}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 w-14 justify-end">
        {isProcessing ? (
          <Spinner className="h-5 w-5 text-blue-600" />
        ) : (
          <>
            <button
              onClick={() => onSetFirstPage(file.name)}
              className={`p-1 rounded-full transition-colors ${isFirstPage ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-100'}`}
              aria-label={isFirstPage ? `إلغاء تثبيت كصفحة أولى` : `تعيين كصفحة أولى`}
              title={isFirstPage ? `إلغاء تثبيت كصفحة أولى` : `تعيين كصفحة أولى`}
            >
              {isFirstPage ? <PinFilledIcon /> : <PinIcon />}
            </button>
            <button
              onClick={() => onRemove(file.name)}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-100"
              aria-label={`إزالة ملف ${file.name}`}
            >
              <RemoveIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
};