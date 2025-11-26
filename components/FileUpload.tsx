import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  descriptionText: string;
  acceptTypes: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled, descriptionText, acceptTypes }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled && e.dataTransfer.files) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  }, [disabled, onFilesSelected]);

  const dropzoneClasses = `flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${
    disabled ? 'bg-slate-200 cursor-not-allowed' :
    isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
  }`;

  return (
    <label
      htmlFor="dropzone-file"
      className={dropzoneClasses}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <UploadIcon />
        <p className="mb-2 text-sm text-slate-500">
          <span className="font-semibold">انقر للرفع</span> أو اسحب وأفلت الملفات
        </p>
        <p className="text-xs text-slate-500">{descriptionText}</p>
      </div>
      <input
        id="dropzone-file"
        type="file"
        className="hidden"
        multiple
        accept={acceptTypes}
        onChange={handleFileChange}
        disabled={disabled}
      />
    </label>
  );
};