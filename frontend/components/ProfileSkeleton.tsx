export default function ProfileSkeleton() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-8 bg-neutral-800 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-neutral-800/60 rounded-md w-64" />
        </div>
      </div>

      {/* Completeness Meter */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-neutral-800 rounded-md w-32" />
          <div className="h-4 bg-neutral-800 rounded-md w-12" />
        </div>
        <div className="w-full h-2.5 bg-neutral-800 rounded-full mb-3" />
        <div className="flex gap-2">
          <div className="h-6 bg-neutral-800 rounded-lg w-28" />
          <div className="h-6 bg-neutral-800 rounded-lg w-24" />
          <div className="h-6 bg-neutral-800 rounded-lg w-28" />
        </div>
      </div>

      <div className="space-y-8">
        {/* Photos Section */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-5 bg-neutral-800 rounded-md w-36 mb-1" />
              <div className="h-3 bg-neutral-800/60 rounded-md w-64" />
            </div>
            <div className="h-4 bg-neutral-800 rounded-md w-10" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-neutral-800" />
            ))}
          </div>
        </div>

        {/* Passions Section */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="h-5 bg-neutral-800 rounded-md w-44 mb-1" />
              <div className="h-3 bg-neutral-800/60 rounded-md w-60" />
            </div>
            <div className="h-4 bg-neutral-800 rounded-md w-20" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 bg-neutral-800 rounded-full w-20" />
            ))}
          </div>
        </div>

        {/* Form Section */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 space-y-5">
          <div>
            <div className="h-3 bg-neutral-800 rounded-md w-24 mb-2" />
            <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="h-3 bg-neutral-800 rounded-md w-16 mb-2" />
              <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
            </div>
            <div>
              <div className="h-3 bg-neutral-800 rounded-md w-24 mb-2" />
              <div className="h-10 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
            </div>
          </div>
          <div>
            <div className="h-3 bg-neutral-800 rounded-md w-12 mb-2" />
            <div className="h-28 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
          </div>
          <div className="h-12 bg-neutral-800 rounded-xl w-full" />
        </div>
      </div>
    </main>
  );
}
