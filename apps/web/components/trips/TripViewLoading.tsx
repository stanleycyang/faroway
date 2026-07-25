export function TripViewLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="h-5 w-16 rounded bg-gray-200 animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-9 w-20 rounded-xl bg-gray-200 animate-pulse" />
          </div>
          <div className="pb-8 space-y-4">
            <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="h-12 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="flex flex-wrap gap-3">
              <div className="h-16 w-72 rounded-2xl bg-gray-200 animate-pulse" />
              <div className="h-16 w-36 rounded-2xl bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="h-32 rounded-2xl bg-gray-200 animate-pulse" />
        {[1, 2, 3].map((day) => (
          <div
            key={day}
            className="h-64 rounded-2xl bg-gray-200 animate-pulse"
          />
        ))}
      </main>
    </div>
  );
}
