"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";

export function ProfileSwitcher() {
  const profiles = useWorldMapStore((s) => s.profiles);
  const activeId = useWorldMapStore((s) => s.activeProfileId);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const switchProfile = useWorldMapStore((s) => s.switchProfile);
  const renameProfile = useWorldMapStore((s) => s.renameProfile);
  const deleteProfile = useWorldMapStore((s) => s.deleteProfile);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const active = profiles.find((p) => p.id === activeId);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!active) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-slate-700 px-3 py-2 rounded-full text-sm font-semibold transition-all"
      >
        <span className="text-lg leading-none">{active.emoji || "🌍"}</span>
        <span className="max-w-[120px] truncate">{active.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-40 animate-fade-in">
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Profiles
          </div>
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            const isEditing = editingId === p.id;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 ${
                  isActive ? "bg-primary/5" : "hover:bg-slate-50"
                } transition-colors`}
              >
                <button
                  type="button"
                  onClick={() => {
                    switchProfile(p.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span className="text-lg leading-none">
                    {p.emoji || "🌍"}
                  </span>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => {
                        renameProfile(p.id, editName);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameProfile(p.id, editName);
                          setEditingId(null);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm bg-white ring-1 ring-primary/40 rounded px-2 py-0.5"
                    />
                  ) : (
                    <span
                      className={`text-sm font-semibold truncate ${
                        isActive ? "text-primary-700" : "text-slate-700"
                      }`}
                    >
                      {p.name}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(p.id);
                    setEditName(p.name);
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {profiles.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Delete profile"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete "${p.name}"? This clears all their pins on this device.`,
                        )
                      ) {
                        deleteProfile(p.id);
                      }
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div className="border-t border-slate-100" />
          <button
            type="button"
            onClick={() => {
              const name = prompt("Name the new profile:");
              if (name) {
                createProfile(name);
                setOpen(false);
              }
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-sm font-semibold text-primary transition-colors"
          >
            <Plus className="w-4 h-4" /> New profile
          </button>
        </div>
      )}
    </div>
  );
}
