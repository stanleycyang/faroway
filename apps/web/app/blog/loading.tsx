export default function BlogLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading travel articles"
      className="min-h-screen pt-20"
    >
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mx-auto mb-10 h-12 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mb-12 aspect-[21/8] animate-pulse rounded-3xl bg-gray-200" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="space-y-4">
              <div className="aspect-[16/9] animate-pulse rounded-2xl bg-gray-200" />
              <div className="h-6 w-4/5 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
