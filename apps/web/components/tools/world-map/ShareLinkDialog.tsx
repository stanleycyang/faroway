"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, X } from "lucide-react";
import { useActiveProfile } from "@/lib/tools/world-map/store";
import { buildShareUrl, encodeProfileToUrl } from "@/lib/tools/world-map/share";

interface Props {
  open: boolean;
  onClose: () => void;
  initiallyCopied?: boolean;
}

export function ShareLinkDialog({ open, onClose, initiallyCopied }: Props) {
  const profile = useActiveProfile();
  const url = useMemo(() => {
    if (!open || !profile) return "";
    return buildShareUrl(encodeProfileToUrl(profile));
  }, [open, profile]);
  const [copied, setCopied] = useState(false);
  const [trackedOpen, setTrackedOpen] = useState(false);

  if (trackedOpen !== open) {
    setTrackedOpen(open);
    setCopied(open ? Boolean(initiallyCopied) : false);
  }

  if (!open) return null;

  async function copyNow() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard errors; link is visible in the input.
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" /> Share your map
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            The link below contains your pins encoded directly — no server, no
            account. Anyone with the link sees a read-only view of your map.
            Photos and notes stay on your device.
          </p>

          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm font-mono text-slate-700 bg-slate-50 focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={copyNow}
              className={`inline-flex items-center gap-1.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
            Paste it anywhere — iMessage, Twitter, Slack, an Instagram bio.
            Old links keep working even if you wipe your browser storage.
          </div>
        </div>
      </div>
    </div>
  );
}
