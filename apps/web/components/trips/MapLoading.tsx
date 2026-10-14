/** Reserves map space while its browser-only code is loading. */
export function MapLoading({
  label = "Preparing your map…",
  className = "min-h-[60vh]",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-stone-50 to-slate-100 px-6 ${className}`}
    >
      <p className="text-center text-sm text-slate-700">{label}</p>
    </div>
  );
}
