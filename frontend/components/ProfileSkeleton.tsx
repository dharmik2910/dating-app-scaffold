export default function ProfileSkeleton() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-neutral-800/80">
        <div>
          <div className="h-8 bg-neutral-800 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-neutral-800/60 rounded-md w-64" />
        </div>
        <div className="w-24 h-9 bg-neutral-800/80 rounded-xl shrink-0" />
      </div>

      {/* Completeness Meter */}
      <div className="bg-neutral-900/80 border border-neutral-800/90 rounded-3xl p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="h-4 bg-neutral-800 rounded-md w-32" />
          <div className="h-4 bg-neutral-800 rounded-md w-10" />
        </div>
        <div className="w-full h-3 bg-neutral-950 rounded-full mb-4 border border-neutral-800/60" />
        <div className="flex flex-wrap gap-2">
          <div className="h-7 bg-neutral-800 rounded-xl w-28" />
          <div className="h-7 bg-neutral-800 rounded-xl w-24" />
          <div className="h-7 bg-neutral-800 rounded-xl w-32" />
        </div>
      </div>

      {/* Profile Details Form (FIRST) */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
          <div className="h-5 bg-neutral-800 rounded-md w-36" />
          <div className="h-3 bg-neutral-800/60 rounded-md w-28" />
        </div>

        {/* Display Name */}
        <div>
          <div className="h-3 bg-neutral-800 rounded-md w-24 mb-2" />
          <div className="h-11 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
        </div>

        {/* Gender & Preference Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="h-3 bg-neutral-800 rounded-md w-16 mb-2" />
            <div className="h-11 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
          </div>
          <div>
            <div className="h-3 bg-neutral-800 rounded-md w-24 mb-2" />
            <div className="h-11 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
          </div>
        </div>

        {/* Bio */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="h-3 bg-neutral-800 rounded-md w-12" />
            <div className="h-3 bg-neutral-800/60 rounded-md w-20" />
          </div>
          <div className="h-28 bg-neutral-950 border border-neutral-800 rounded-xl w-full" />
        </div>

        {/* Passions & Interests Selector */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="h-4 bg-neutral-800 rounded-md w-40 mb-1" />
              <div className="h-3 bg-neutral-800/60 rounded-md w-64" />
            </div>
            <div className="h-3 bg-neutral-800 rounded-md w-20" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-7 bg-neutral-800 rounded-full w-20" />
            ))}
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-4 border-t border-neutral-800/80">
          <div className="h-12 bg-neutral-800 rounded-xl w-full" />
        </div>
      </div>

      {/* Photos & Media Section (SECOND) */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
          <div>
            <div className="h-5 bg-neutral-800 rounded-md w-36 mb-1" />
            <div className="h-3 bg-neutral-800/60 rounded-md w-72" />
          </div>
          <div className="h-6 bg-neutral-950 border border-neutral-800 rounded-full w-12" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-neutral-950 border border-neutral-800" />
          ))}
        </div>
      </div>
    </main>
  );
}

