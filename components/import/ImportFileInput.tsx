"use client";

import { useRef } from "react";
import { getFormatsAcceptesLabel, getModuleAcceptAttribute, type ImportModule } from "@/lib/import/accepted-formats";

type ImportFileInputProps = {
  module: ImportModule;
  multiple?: boolean;
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  className?: string;
  showHelp?: boolean;
};

export function ImportFileInput({
  module,
  multiple = false,
  disabled = false,
  onFilesSelected,
  className = "hidden",
  showHelp = false,
}: ImportFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null | undefined) => {
    if (!fileList?.length) return;
    onFilesSelected(Array.from(fileList));
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={getModuleAcceptAttribute(module)}
        disabled={disabled}
        className={className}
        onChange={(event) => handleFiles(event.target.files)}
      />
      {showHelp ? (
        <p className="text-xs font-light opacity-80">{getFormatsAcceptesLabel(module)}</p>
      ) : null}
    </>
  );
}

export function openImportFilePicker(inputRef: React.RefObject<HTMLInputElement | null>) {
  inputRef.current?.click();
}
