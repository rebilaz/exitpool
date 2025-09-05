"use client";

import { useState, DragEvent } from "react";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
}

export default function FileDropzone({ onFileSelect }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        group relative flex flex-col items-center justify-center
        w-full max-w-md mx-auto h-56 rounded-2xl border-2 border-dashed
        transition-all cursor-pointer
        ${isDragging ? "border-black/80 bg-gray-50" : "border-gray-300 bg-white"}
      `}
    >
      <Upload className="w-10 h-10 text-gray-400 group-hover:text-black transition-colors" />
      <p className="mt-3 text-sm text-gray-600">
        Glissez votre fichier ici
      </p>
      <p className="text-xs text-gray-400">ou cliquez pour parcourir</p>
      <input
        type="file"
        accept=".csv,.xlsx"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
    </div>
  );
}

