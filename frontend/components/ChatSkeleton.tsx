export default function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 animate-pulse">
      {/* Received message skeleton */}
      <div className="flex flex-col items-start max-w-[75%]">
        <div className="h-10 bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm w-48 mb-1" />
        <div className="h-2.5 bg-neutral-800/60 rounded w-10 ml-1" />
      </div>

      {/* Sent message skeleton */}
      <div className="flex flex-col items-end max-w-[75%] ml-auto">
        <div className="h-12 bg-neutral-800 rounded-2xl rounded-tr-sm w-56 mb-1" />
        <div className="h-2.5 bg-neutral-800/60 rounded w-10 mr-1" />
      </div>

      {/* Received message skeleton */}
      <div className="flex flex-col items-start max-w-[75%]">
        <div className="h-14 bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-sm w-64 mb-1" />
        <div className="h-2.5 bg-neutral-800/60 rounded w-10 ml-1" />
      </div>

      {/* Sent message skeleton */}
      <div className="flex flex-col items-end max-w-[75%] ml-auto">
        <div className="h-9 bg-neutral-800 rounded-2xl rounded-tr-sm w-36 mb-1" />
        <div className="h-2.5 bg-neutral-800/60 rounded w-10 mr-1" />
      </div>
    </div>
  );
}
