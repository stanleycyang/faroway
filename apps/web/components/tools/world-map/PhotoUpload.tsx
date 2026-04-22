"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { compressImageToDataUrl } from "@/lib/tools/world-map/photo";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}

export function PhotoUpload({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange(dataUrl);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden ring-1 ring-slate-200/70 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Cover"
          className="w-full h-40 object-cover"
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900 transition-colors"
          aria-label="Remove photo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <label
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-primary/60 transition-colors py-8 cursor-pointer ${
        busy ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <Camera className="w-6 h-6 text-slate-400" />
      <span className="text-sm text-slate-600 font-medium">
        {busy ? "Compressing…" : "Click to upload photo"}
      </span>
      <span className="text-xs text-slate-400">
        JPEG/PNG · auto-compressed to ~120KB
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleFile}
      />
    </label>
  );
}
