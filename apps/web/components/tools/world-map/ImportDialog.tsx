"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";
import type { AppState, Profile } from "@/lib/tools/world-map/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Parsed =
  | { kind: "state"; state: AppState }
  | { kind: "profile"; profile: Profile };

function validate(json: unknown): Parsed | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj.profiles) && typeof obj.activeProfileId === "string") {
    return { kind: "state", state: obj as unknown as AppState };
  }
  if (
    typeof obj.id === "string" &&
    obj.visits &&
    typeof obj.visits === "object"
  ) {
    return { kind: "profile", profile: obj as unknown as Profile };
  }
  return null;
}

export function ImportDialog({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mergeProfile = useWorldMapStore((s) => s.mergeProfile);
  const mergeProfiles = useWorldMapStore((s) => s.mergeProfiles);
  const replaceAll = useWorldMapStore((s) => s.replaceAll);

  function reset() {
    setParsed(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validated = validate(json);
      if (!validated) {
        setError("This doesn't look like a valid backup file.");
        setParsed(null);
        return;
      }
      setParsed(validated);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't parse that file.");
      setParsed(null);
    }
  }

  function doImport(mode: "merge" | "replace") {
    if (!parsed) return;
    if (parsed.kind === "state") {
      if (mode === "replace") {
        replaceAll(parsed.state);
      } else {
        // Merge every incoming profile — overlapping IDs merge visits, new IDs
        // are added as additional profiles.
        mergeProfiles(parsed.state.profiles, "merge");
      }
    } else {
      mergeProfile(parsed.profile, mode);
    }
    reset();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 font-serif">
            Restore from backup
          </h3>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-primary/60 transition-colors py-8 cursor-pointer">
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm text-slate-600 font-medium">
              Choose a JSON backup file
            </span>
            <span className="text-xs text-slate-400">
              Previously exported from this page
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {parsed && (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-3 text-sm text-emerald-800">
                {parsed.kind === "state" ? (
                  <>
                    Backup contains {parsed.state.profiles.length}{" "}
                    {parsed.state.profiles.length === 1
                      ? "profile"
                      : "profiles"}
                    .
                  </>
                ) : (
                  <>
                    Profile &ldquo;{parsed.profile.name}&rdquo; ·{" "}
                    {Object.keys(parsed.profile.visits).length} countries.
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => doImport("merge")}
                  className="py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Merge into current
                </button>
                <button
                  type="button"
                  onClick={() => doImport("replace")}
                  className="py-2.5 rounded-xl ring-1 ring-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Replace current
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center">
                Merge keeps existing pins where they overlap · Replace
                overwrites them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
