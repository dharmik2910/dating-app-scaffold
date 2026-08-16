interface ChatListSkeletonProps {
  count?: number;
}

export default function ChatListSkeleton({ count = 5 }: ChatListSkeletonProps) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm"
        >
          {/* Avatar Skeleton */}
          <div className="w-14 h-14 rounded-full bg-neutral-800 shrink-0" />

          {/* Content Skeleton */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-2">
              <div className="h-4 bg-neutral-800 rounded-md w-32" />
              <div className="h-3 bg-neutral-800/60 rounded-md w-12" />
            </div>
            <div className="h-3 bg-neutral-800/50 rounded-md w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
