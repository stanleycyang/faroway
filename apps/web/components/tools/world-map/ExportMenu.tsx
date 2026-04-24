"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Link2,
  Smartphone,
  Square,
  Upload,
} from "lucide-react";
import { useActiveProfile } from "@/lib/tools/world-map/store";
import { downloadBackupJson } from "@/lib/tools/world-map/backup";
import { buildShareUrl, encodeProfileToUrl } from "@/lib/tools/world-map/share";

interface Props {
  onOpenImport: () => void;
  onOpenShare: (alreadyCopied: boolean) => void;
}

type Aspect = "landscape" | "square" | "story";

export function ExportMenu({ onOpenImport, onOpenShare }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const profile = useActiveProfile();

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
    downloadBackupJson();
    setOpen(false);
  }

  async function downloadPng(aspect: Aspect) {
    if (!profile) return;
    setBusy(`png-${aspect}`);
    try {
      const encoded = encodeProfileToUrl(profile);
      const url = `/api/og/world-map?format=${aspect}&d=${encodeURIComponent(encoded)}`;
      // Fetch as blob so we can force a download with a friendly filename.
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OG render failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = blobUrl;
      a.download = `world-map-${aspect}-${today}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("PNG export failed", err);
      alert("Couldn't generate the image. Try again in a moment.");
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
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-40 animate-fade-in">
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

          <div className="border-t border-slate-100 px-4 pt-3 pb-2">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Download as poster
            </div>
          </div>
          <AspectButton
            label="Landscape"
            hint="Best for X / blog headers"
            icon={<ImageIcon className="w-4 h-4" />}
            busy={busy === "png-landscape"}
            onClick={() => downloadPng("landscape")}
          />
          <AspectButton
            label="Square"
            hint="Instagram feed"
            icon={<Square className="w-4 h-4" />}
            busy={busy === "png-square"}
            onClick={() => downloadPng("square")}
          />
          <AspectButton
            label="Story (9:16)"
            hint="Instagram / TikTok stories"
            icon={<Smartphone className="w-4 h-4" />}
            busy={busy === "png-story"}
            onClick={() => downloadPng("story")}
          />

          <div className="border-t border-slate-100" />
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

function AspectButton({
  label,
  hint,
  icon,
  busy,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full flex items-start gap-3 text-left px-4 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-60"
    >
      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">
          {busy ? "Rendering…" : label}
        </div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
    </button>
  );
}
