type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

interface DiscoverSkeletonProps {
  viewMode?: ViewMode;
  count?: number;
}

export default function DiscoverSkeleton({ viewMode = 'grid5', count }: DiscoverSkeletonProps) {
  const skeletonCount =
    count ??
    (viewMode === 'grid5' ? 15 : viewMode === 'grid3' ? 6 : viewMode === 'grid2' ? 6 : viewMode === 'grid1' ? 3 : 5);

  return (
    <div
      className={
        viewMode === 'grid5'
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5'
          : viewMode === 'grid3'
            ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6'
            : viewMode === 'grid2'
              ? 'grid grid-cols-2 gap-3 max-w-3xl mx-auto w-full'
              : viewMode === 'grid1'
                ? 'flex flex-col items-center gap-6 max-w-md mx-auto w-full'
                : 'flex flex-col gap-3 max-w-4xl mx-auto w-full'
      }
    >
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className={`group relative bg-neutral-900/90 border border-neutral-800/80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl animate-pulse ${
            viewMode === 'list'
              ? 'flex flex-row items-center p-2.5 sm:p-3 gap-3 sm:gap-4 w-full'
              : 'w-full aspect-[3/4] flex flex-col'
          }`}
        >
          {viewMode === 'list' ? (
            <>
              {/* Avatar placeholder */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neutral-800/80 shrink-0" />
              {/* Details placeholder */}
              <div className="flex-1 min-w-0 pr-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 sm:h-5 bg-neutral-800 rounded-md w-1/3" />
                  <div className="h-4 w-16 bg-neutral-800/70 rounded-full" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-800/60" />
                  <div className="h-3 bg-neutral-800/60 rounded-md w-1/4" />
                </div>
              </div>
              {/* Action button placeholder */}
              <div className="w-10 h-10 rounded-2xl bg-neutral-800/80 shrink-0 ml-2" />
            </>
          ) : (
            <div className="relative w-full h-full bg-neutral-900 overflow-hidden">
              {/* Subtle top photo indicator placeholder */}
              <div className="absolute top-2 inset-x-2 sm:top-2.5 sm:inset-x-3 flex gap-1 z-30 pointer-events-none opacity-40">
                <div className="h-0.5 sm:h-1 flex-1 rounded-full bg-neutral-700/50" />
                <div className="h-0.5 sm:h-1 flex-1 rounded-full bg-neutral-700/25" />
              </div>

              {/* Status pill placeholder (top-left) */}
              <div className="absolute top-2 left-2 sm:top-3.5 sm:left-3.5 z-20 flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/40 border border-neutral-700/40">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-neutral-600" />
                <div className="w-10 sm:w-12 h-2 sm:h-2.5 bg-neutral-700/60 rounded" />
              </div>

              {/* Match heart button placeholder (top-right) */}
              <div className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/30 border border-neutral-700/30 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-neutral-700/50" />
              </div>

              {/* Gradient scrim overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

              {/* Bottom text info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 text-white pointer-events-none z-20">
                {/* Name + badge line */}
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5">
                  <div className="h-3.5 sm:h-4.5 bg-neutral-700/70 rounded-md w-2/5" />
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-neutral-700/50 shrink-0" />
                </div>
                {/* Location / distance line */}
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-700/50 shrink-0" />
                  <div className="h-2.5 sm:h-3 bg-neutral-700/50 rounded-md w-1/3" />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
