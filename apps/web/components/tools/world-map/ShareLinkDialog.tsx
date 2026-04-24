"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, MessageCircle, Share2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useActiveProfile } from "@/lib/tools/world-map/store";
import { buildShareUrl, encodeProfileToUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  smsIntent,
  socialShareText,
  threadsIntent,
  twitterIntent,
} from "@/lib/tools/world-map/social";

interface Props {
  open: boolean;
  onClose: () => void;
  initiallyCopied?: boolean;
}

export function ShareLinkDialog({ open, onClose, initiallyCopied }: Props) {
  const profile = useActiveProfile();

  const { url, text } = useMemo(() => {
    if (!open || !profile) return { url: "", text: "" };
    const encoded = encodeProfileToUrl(profile);
    const shareUrl = buildShareUrl(encoded);
    const stats = computeStats(profile.visits);
    const shareText = socialShareText(
      profile.name,
      stats.totalVisited,
      stats.continentsVisited,
    );
    return { url: shareUrl, text: shareText };
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

  function openIntent(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({ title: "My World Map", text, url });
    } catch {
      // User dismissed the share sheet; ignore.
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
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

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Your pins are encoded directly into the link — no server, no
            account. Anyone with the link sees a read-only view. Photos and
            notes stay on your device.
          </p>

          {/* Primary share row */}
          <div className="grid grid-cols-4 gap-2">
            <ShareButton
              label="Twitter"
              onClick={() => openIntent(twitterIntent(url, text))}
            >
              <XLogo />
            </ShareButton>
            <ShareButton
              label="Threads"
              onClick={() => openIntent(threadsIntent(text, url))}
            >
              <ThreadsLogo />
            </ShareButton>
            <ShareButton
              label="iMessage"
              onClick={() => openIntent(smsIntent(text, url))}
            >
              <MessageCircle className="w-5 h-5" />
            </ShareButton>
            {canNativeShare ? (
              <ShareButton label="More…" onClick={nativeShare}>
                <Share2 className="w-5 h-5" />
              </ShareButton>
            ) : (
              <ShareButton label={copied ? "Copied" : "Copy"} onClick={copyNow}>
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </ShareButton>
            )}
          </div>

          {/* URL + copy */}
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

          {/* QR */}
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4 ring-1 ring-slate-200/70">
            <div className="bg-white p-2 rounded-lg ring-1 ring-slate-200">
              <QRCodeSVG
                value={url}
                size={96}
                marginSize={0}
                fgColor="#0f172a"
                bgColor="#ffffff"
                level="M"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                Hand it off in person
              </div>
              <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                Scan this with a phone camera — it opens your map in any
                browser. Link keeps working even if you clear storage.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200/70 text-slate-700 transition-colors"
    >
      {children}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function XLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ThreadsLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 192 192"
      fill="currentColor"
      aria-hidden
    >
      <path d="M141.537 88.988a66 66 0 00-2.483-1.114c-1.46-26.888-16.148-42.282-40.818-42.44h-.335c-14.756 0-27.022 6.302-34.577 17.784l13.567 9.315c5.644-8.562 14.488-10.385 21.017-10.385h.225c8.13.05 14.267 2.412 18.241 7.02 2.893 3.359 4.823 8 5.82 13.825-7.511-1.275-15.633-1.67-24.326-1.18-24.493 1.41-40.24 15.71-39.184 35.583.537 10.079 5.558 18.749 14.139 24.415 7.253 4.79 16.597 7.142 26.295 6.61 12.805-.71 22.85-5.597 29.853-14.528 5.324-6.814 8.698-15.649 10.211-26.732 6.232 3.771 10.85 8.734 13.392 14.693 4.325 10.134 4.576 26.757-8.992 40.326-11.896 11.896-26.232 17.039-47.944 17.198-24.096-.179-42.44-7.845-54.509-22.788-11.302-13.982-17.142-34.116-17.36-59.836.218-25.72 6.058-45.854 17.36-59.833 12.07-14.946 30.413-22.612 54.508-22.791 24.212.179 42.662 7.841 54.91 22.792 6.032 7.336 10.6 16.516 13.632 27.236l15.632-4.14c-3.605-13.132-9.329-24.417-17.11-33.808Q166.096 31.408 161 25.44l-.076-.09-.079-.086A77 77 0 00148 14.022l-.065-.046-.064-.05C131.48 4.347 113.213-.18 93.153 0H93.02C73.097 0 54.94 4.32 39.34 13.855l-.064.046-.063.05a77 77 0 00-12.854 10.814L26.28 25l-.076.09Q14.92 37.88 8.05 56.017c-5.51 14.55-8.337 31.148-8.4 49.323v.32c.063 18.175 2.89 34.773 8.4 49.323q6.87 18.14 18.154 30.95l.076.09.079.086a77 77 0 0012.854 10.814l.063.05.064.046C54.94 206.68 73.097 211 93.02 211h.133c20.06.18 38.327-4.347 54.717-13.926l.064-.05.065-.046a77 77 0 0012.855-10.814l.079-.086.076-.09q11.284-12.81 18.154-30.95c5.51-14.55 8.337-31.148 8.4-49.323v-.32c-.016-4.55-.206-8.998-.568-13.344zm-43.497 16.25c-4.068.23-8.302-.005-12.612-.725-5.38-3.016-6.11-8.116-6.252-11.175-.314-6.766 3.878-11.63 11.53-12.4 1.526-.152 3.03-.227 4.51-.227 6.127 0 11.728.81 16.738 1.89 2.142 13.75-6.55 22.21-13.914 22.637" />
    </svg>
  );
}
