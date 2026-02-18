export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              <div className="w-24 h-6 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 h-4 bg-gray-200 rounded animate-pulse hidden sm:block" />
              <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="w-48 h-8 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-64 h-5 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="w-40 h-12 bg-gray-200 rounded-full animate-pulse" />
        </div>

        {/* Stats Section Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-gray-200"
            >
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse mb-3" />
              <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Trips Section Skeleton */}
        <div className="mb-6">
          <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        </div>

        {/* Trip Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
            >
              <div className="h-48 bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
