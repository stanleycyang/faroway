'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'tripgenie_banner_dismissed';
const DISMISS_DAYS = 7;

function isMobileBrowser() {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }
    setIsMobile(isMobileBrowser());
    setMounted(true);
    // Delay for slide-in animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setMounted(false), 300);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!mounted) return null;

  // Mobile: bottom sticky banner
  if (isMobile) {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-[60] transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-gradient-to-r from-primary-600 to-primary text-white px-4 py-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-lg">
              ✈️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Get the TripGenie App</p>
              <p className="text-white/80 text-xs">Plan trips on the go • Offline access</p>
            </div>
            <a
              href={
                /iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
                  ? 'https://apps.apple.com/app/tripgenie'
                  : 'https://play.google.com/store/apps/details?id=com.tripgenie'
              }
              className="bg-white text-primary font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 hover:bg-white/90 transition-colors"
            >
              Open
            </a>
            <button onClick={dismiss} className="p-1 flex-shrink-0 hover:bg-white/20 rounded-full transition-colors" aria-label="Dismiss banner">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: top banner
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-gradient-to-r from-primary-600 via-primary to-primary-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-4 text-sm">
          <span className="font-medium">📱 TripGenie is better on mobile!</span>
          <div className="flex items-center gap-2">
            <a
              href="https://apps.apple.com/app/tripgenie"
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium transition-colors"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.tripgenie"
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium transition-colors"
            >
              Google Play
            </a>
          </div>
          <button onClick={dismiss} className="p-1 hover:bg-white/20 rounded-full transition-colors ml-2" aria-label="Dismiss banner">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
