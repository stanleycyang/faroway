export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading article"
      className="min-h-screen pt-20"
    >
      <div className="max-w-5xl mx-auto px-6 py-10 animate-pulse">
        <div className="h-5 w-56 rounded bg-gray-200 mb-8" />
        <div className="h-12 w-5/6 rounded bg-gray-200 mb-4" />
        <div className="h-6 w-2/3 rounded bg-gray-200 mb-8" />
        <div className="aspect-[21/9] rounded-3xl bg-gray-200 mb-10" />
        <div className="max-w-3xl mx-auto space-y-4">
          {[100, 92, 96, 80, 98, 88, 94, 72].map((width, index) => (
            <div
              key={`${width}-${index}`}
              className="h-5 rounded bg-gray-200"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
