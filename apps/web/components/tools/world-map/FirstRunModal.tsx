"use client";

import { useState } from "react";
import { Globe2 } from "lucide-react";

interface Props {
  onSubmit: (name: string, emoji?: string) => void;
}

const EMOJI_OPTIONS = [
  "🌍",
  "🧳",
  "✈️",
  "🗺️",
  "🎒",
  "🚀",
  "🧔",
  "👩",
  "🏔️",
  "🌴",
];

export function FirstRunModal({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌍");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(name.trim() || "Traveler", emoji);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 animate-slide-up"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
          <Globe2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-2 font-serif">
          Welcome to your <span className="text-gradient">World Map</span>
        </h2>
        <p className="text-slate-600 text-center mb-6 text-sm leading-relaxed">
          Pin every country you&apos;ve lived in, visited, or still dream of. No
          account needed — everything saves to your browser.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="wm-name"
              className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block"
            >
              Your name
            </label>
            <input
              id="wm-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stanley"
              className="w-full rounded-lg ring-1 ring-slate-200 px-4 py-2.5 text-base focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
              Pick an avatar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all ${
                    emoji === e
                      ? "bg-primary/10 ring-2 ring-primary/60 scale-110"
                      : "hover:bg-slate-100 ring-1 ring-slate-200"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-6 py-3.5 rounded-full text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
        >
          Start pinning
        </button>
        <p className="text-xs text-slate-400 text-center mt-3">
          Data lives in your browser. Export a JSON backup anytime.
        </p>
      </form>
    </div>
  );
}
