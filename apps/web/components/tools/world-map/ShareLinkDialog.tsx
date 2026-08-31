"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, MessageCircle, Share2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { useActiveProfile } from "@/lib/tools/world-map/store";
import { buildShareUrl, encodeProfileToUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  smsIntent,
  socialShareText,
  threadsIntent,
  twitterIntent,
} from "@/lib/tools/world-map/social";
import { WorldMap } from "./WorldMap";

interface Props {
  open: boolean;
  onClose: () => void;
  initiallyCopied?: boolean;
}

export function ShareLinkDialog({ open, onClose, initiallyCopied }: Props) {
  const profile = useActiveProfile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { url, text, stats } = useMemo(() => {
    if (!open || !profile) {
      return {
        url: "",
        text: "",
        stats: { totalVisited: 0, continentsVisited: 0 },
      };
    }
    const encoded = encodeProfileToUrl(profile);
    const shareUrl = buildShareUrl(encoded);
    const s = computeStats(profile.visits);
    return {
      url: shareUrl,
      text: socialShareText(profile.name, s.totalVisited, s.continentsVisited),
      stats: s,
    };
  }, [open, profile]);

  const [copied, setCopied] = useState(Boolean(initiallyCopied));

  useModalFocusTrap({ open, dialogRef, onClose });

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  if (!open || !profile) return null;

  async function copyNow() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* link is visible in the field */
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
      /* user dismissed */
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-map-title"
        tabIndex={-1}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up max-h-[92vh] flex flex-col outline-none"
      >
        {/* Visual hero — the actual map */}
        <div className="relative bg-gradient-to-br from-amber-50 via-white to-rose-50 px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur hover:bg-white flex items-center justify-center text-slate-500 shadow ring-1 ring-slate-200/50 z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h2
            id="share-map-title"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400"
          >
            Share your map
          </h2>
          <div className="mt-1.5 flex items-baseline gap-2">
            <div className="text-4xl font-bold tabular-nums text-slate-900 font-serif">
              {stats.totalVisited}
            </div>
            <div className="text-sm text-slate-500">
              {stats.totalVisited === 1 ? "country" : "countries"} ·{" "}
              {stats.continentsVisited}{" "}
              {stats.continentsVisited === 1 ? "continent" : "continents"}
            </div>
          </div>

          <div className="mt-3 aspect-[2/1] w-full">
            <WorldMap visits={profile.visits} readOnly />
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Primary share buttons */}
          <div className="grid grid-cols-4 gap-2">
            <ShareButton
              label="X / Twitter"
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
              <ShareButton label="More" onClick={nativeShare}>
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

          {/* Copy URL */}
          <button
            type="button"
            onClick={copyNow}
            className="w-full flex items-center gap-3 rounded-xl bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200/70 px-4 py-3 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Link
              </div>
              <div className="text-xs font-mono text-slate-700 truncate mt-0.5">
                {url}
              </div>
            </div>
            <span
              className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold ${
                copied ? "text-emerald-600" : "text-slate-700"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </span>
          </button>

          {/* QR — small, secondary */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 list-none flex items-center justify-between">
              <span>QR for in-person hand-off</span>
              <span className="text-slate-400 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="mt-3 flex items-center justify-center bg-white p-3 rounded-xl ring-1 ring-slate-200">
              <QRCodeSVG
                value={url}
                size={144}
                marginSize={0}
                fgColor="#0f172a"
                bgColor="#ffffff"
                level="M"
              />
            </div>
          </details>
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
      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors"
    >
      {children}
      <span className="text-[10px] font-bold uppercase tracking-wide">
        {label}
      </span>
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
