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

import type { Profile } from "@/lib/tools/world-map/types";

type Aspect = "landscape" | "square" | "story";

export function ExportMenu({ onOpenImport, onOpenShare }: Props) {
  const profile = useActiveProfile();
  return (
    <ExportSession
      key={profile?.id ?? "none"}
      profile={profile}
      onOpenImport={onOpenImport}
      onOpenShare={onOpenShare}
    />
  );
}

function ExportSession({
  onOpenImport,
  onOpenShare,
  profile,
}: Props & { profile: Profile | undefined }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  async function bounded<T>(
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    controllerRef.current = controller;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(new Error("Export interrupted")),
        { once: true },
      );
      deadline = setTimeout(() => controller.abort(), 15_000);
    });
    try {
      return await Promise.race([work(controller.signal), interrupted]);
    } finally {
      clearTimeout(deadline);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function begin(action: string) {
    if (!profile || busyRef.current || !mounted.current) return false;
    busyRef.current = true;
    setBusy(action);
    setError(null);
    return true;
  }

  function finish() {
    busyRef.current = false;
    if (mounted.current) setBusy(null);
  }

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
    if (!begin("backup")) return;
    try {
      downloadBackupJson();
      setOpen(false);
    } catch {
      setError("Your backup couldn’t download. Try again from this menu.");
    } finally {
      finish();
    }
  }

  async function downloadPng(aspect: Aspect) {
    if (!profile || !begin(`png-${aspect}`)) return;
    try {
      const encoded = encodeProfileToUrl(profile);
      const url = `/api/og/world-map?format=${aspect}&d=${encodeURIComponent(encoded)}`;
      const blob = await bounded(async (signal) => {
        const res = await fetch(url, { signal });
        if (signal.aborted || !mounted.current)
          throw new Error("Export interrupted");
        if (!res.ok) throw new Error("Poster unavailable");
        return res.blob();
      });
      if (!mounted.current) return;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      try {
        const today = new Date().toISOString().slice(0, 10);
        a.href = blobUrl;
        a.download = `world-map-${aspect}-${today}.png`;
        document.body.appendChild(a);
        a.click();
        setOpen(false);
      } finally {
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      if (mounted.current)
        setError(
          "Your poster couldn’t download. Choose a format to try again, or download a backup.",
        );
    } finally {
      finish();
    }
  }

  async function copyShareLink() {
    if (!profile || !begin("share")) return;
    let copied = false;
    try {
      const encoded = encodeProfileToUrl(profile);
      const url = buildShareUrl(encoded);
      await bounded(() => navigator.clipboard.writeText(url));
      copied = true;
    } catch {
      // The share dialog offers the link for manual copying.
    } finally {
      finish();
      if (mounted.current) {
        setOpen(false);
        onOpenShare(copied);
      }
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Share and export"
        aria-expanded={open}
        aria-controls={open ? "world-map-export-menu" : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
      >
        <Download className="w-4 h-4" />
        Share & Export
      </button>

      {open && (
        <div
          id="world-map-export-menu"
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-40 animate-fade-in"
        >
          {error && (
            <p
              role="alert"
              className="px-4 py-3 text-sm text-red-700 bg-red-50"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={copyShareLink}
            disabled={busy !== null || !profile}
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
            disabled={busy !== null || !profile}
            onClick={() => downloadPng("landscape")}
          />
          <AspectButton
            label="Square"
            hint="Instagram feed"
            icon={<Square className="w-4 h-4" />}
            busy={busy === "png-square"}
            disabled={busy !== null || !profile}
            onClick={() => downloadPng("square")}
          />
          <AspectButton
            label="Story (9:16)"
            hint="Instagram / TikTok stories"
            icon={<Smartphone className="w-4 h-4" />}
            busy={busy === "png-story"}
            disabled={busy !== null || !profile}
            onClick={() => downloadPng("story")}
          />

          <div className="border-t border-slate-100" />
          <button
            type="button"
            onClick={downloadJson}
            disabled={busy !== null || !profile}
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
            disabled={busy !== null}
            onClick={() => {
              if (busyRef.current) return;
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
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
