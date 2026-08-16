type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

interface DiscoverSkeletonProps {
  viewMode?: ViewMode;
  count?: number;
}

export default function DiscoverSkeleton({ viewMode = 'grid5', count }: DiscoverSkeletonProps) {
  const skeletonCount =
    count ??
    (viewMode === 'grid5' ? 10 : viewMode === 'grid3' ? 6 : viewMode === 'grid2' ? 4 : viewMode === 'grid1' ? 3 : 5);

  return (
    <div
      className={
        viewMode === 'grid5'
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5'
          : viewMode === 'grid3'
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'
          : viewMode === 'grid2'
          ? 'grid grid-cols-2 gap-4 max-w-3xl mx-auto w-full'
          : viewMode === 'grid1'
          ? 'flex flex-col items-center gap-6 max-w-md mx-auto w-full'
          : 'flex flex-col gap-3 max-w-3xl mx-auto w-full'
      }
    >
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className={`bg-neutral-900 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-xl animate-pulse ${
            viewMode === 'list' ? 'flex flex-row items-center p-3 gap-4 w-full' : 'flex flex-col w-full'
          }`}
        >
          {viewMode === 'list' ? (
            <>
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-neutral-800 flex-shrink-0" />
              <div className="flex-1 min-w-0 pr-2">
                <div className="h-4 bg-neutral-800 rounded-md w-1/3 mb-2" />
                <div className="h-3 bg-neutral-800/70 rounded-md w-1/4 mb-3" />
                <div className="h-3 bg-neutral-800/50 rounded-md w-3/4 mb-2" />
                <div className="flex gap-1.5 mt-2">
                  <div className="h-5 bg-neutral-800 rounded-md w-14" />
                  <div className="h-5 bg-neutral-800 rounded-md w-16" />
                  <div className="h-5 bg-neutral-800 rounded-md w-12" />
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-neutral-800 flex-shrink-0 ml-auto" />
            </>
          ) : (
            <div className="relative aspect-[3/4] w-full bg-neutral-800 overflow-hidden">
              <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-neutral-700/40" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent">
                <div className="h-5 bg-neutral-700/60 rounded-md w-1/2 mb-2" />
                <div className="h-3 bg-neutral-700/40 rounded-md w-1/3 mb-2" />
                <div className="h-3 bg-neutral-700/30 rounded-md w-4/5 mb-1.5" />
                <div className="h-3 bg-neutral-700/30 rounded-md w-2/3 mb-3" />
                <div className="flex gap-1.5">
                  <div className="h-5 bg-neutral-700/40 rounded-full w-14" />
                  <div className="h-5 bg-neutral-700/40 rounded-full w-16" />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
