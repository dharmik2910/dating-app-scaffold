import ChatSkeleton from './ChatSkeleton';

interface ChatListSkeletonProps {
  count?: number;
}

export default function ChatListSkeleton({ count = 5 }: ChatListSkeletonProps) {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden animate-pulse">
      {/* LEFT SIDE: Conversations Sidebar & New Matches Stories */}
      <div className="lg:col-span-4 flex flex-col h-full bg-neutral-900/40 border border-neutral-800/80 rounded-3xl p-4 overflow-hidden max-w-full space-y-4">
        {/* New Matches Story Row Skeleton */}
        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-neutral-800 rounded-md w-24" />
            <div className="h-3 bg-neutral-800/60 rounded-md w-16" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700" />
                <div className="h-2.5 bg-neutral-800/70 rounded-md w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Search Input Skeleton */}
        <div className="h-9 bg-neutral-950/80 border border-neutral-800 rounded-xl shrink-0" />

        {/* Recent Conversations Scroll List */}
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="h-2.5 bg-neutral-800/60 rounded-md w-32 mb-2" />
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-950/40 border border-neutral-800/60"
            >
              {/* Avatar Skeleton */}
              <div className="w-11 h-11 rounded-full bg-neutral-800 shrink-0" />

              {/* Content Skeleton */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1.5">
                  <div className="h-3.5 bg-neutral-800 rounded-md w-28" />
                  <div className="h-2.5 bg-neutral-800/60 rounded-md w-10" />
                </div>
                <div className="h-2.5 bg-neutral-800/50 rounded-md w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Inline Live Chat Room for Desktop */}
      <div className="hidden lg:flex lg:col-span-8 flex-col h-full bg-neutral-950 border border-neutral-800/90 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-800 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-neutral-800 rounded-md w-28" />
              <div className="h-2.5 bg-neutral-800/60 rounded-md w-16" />
            </div>
          </div>
          <div className="h-7 bg-neutral-800/60 rounded-full w-24" />
        </div>

        {/* Chat Body */}
        <ChatSkeleton />

        {/* Bottom Input Bar */}
        <div className="border-t border-neutral-800/80 p-3 bg-neutral-900/60 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neutral-800 shrink-0" />
          <div className="flex-1 h-9 rounded-full bg-neutral-900 border border-neutral-800" />
          <div className="w-16 h-8 rounded-full bg-neutral-800 shrink-0" />
        </div>
      </div>
    </div>
  );
}

