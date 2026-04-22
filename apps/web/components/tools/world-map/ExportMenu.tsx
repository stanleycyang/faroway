"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Link2, Upload } from "lucide-react";
import {
  getAppStateSnapshot,
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { toPng } from "html-to-image";
import { buildShareUrl, encodeProfileToUrl } from "@/lib/tools/world-map/share";

interface Props {
  mapRef: React.RefObject<HTMLElement | null>;
  onOpenImport: () => void;
  onOpenShare: (alreadyCopied: boolean) => void;
}

export function ExportMenu({ mapRef, onOpenImport, onOpenShare }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const profile = useActiveProfile();
  const markBackupTaken = useWorldMapStore((s) => s.markBackupTaken);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function downloadJson() {
    const snapshot = getAppStateSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `world-map-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    markBackupTaken();
    setOpen(false);
  }

  async function downloadPng() {
    if (!mapRef.current) return;
    setBusy("png");
    try {
      const dataUrl = await toPng(mapRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = dataUrl;
      a.download = `world-map-${today}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("PNG export failed", err);
      alert(
        "Couldn't generate the image. Try zooming out so the whole map fits.",
      );
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  async function copyShareLink() {
    if (!profile) return;
    setBusy("share");
    let copied = false;
    try {
      const encoded = encodeProfileToUrl(profile);
      const url = buildShareUrl(encoded);
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (err) {
      console.error("Share link copy failed", err);
    } finally {
      setBusy(null);
      setOpen(false);
      onOpenShare(copied);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
      >
        <Download className="w-4 h-4" />
        Share & Export
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-40 animate-fade-in">
          <button
            type="button"
            onClick={copyShareLink}
            disabled={busy === "share"}
            className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Copy share link
              </div>
              <div className="text-xs text-slate-500">
                Read-only URL, no backend
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={downloadPng}
            disabled={busy === "png"}
            className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {busy === "png" ? "Rendering…" : "Download as image"}
              </div>
              <div className="text-xs text-slate-500">PNG for socials</div>
            </div>
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Download backup
              </div>
              <div className="text-xs text-slate-500">
                Full JSON with photos
              </div>
            </div>
          </button>
          <div className="border-t border-slate-100" />
          <button
            type="button"
            onClick={() => {
              onOpenImport();
              setOpen(false);
            }}
            className="w-full flex items-start gap-3 text-left px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Restore from backup
              </div>
              <div className="text-xs text-slate-500">
                Merge or replace from JSON
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
