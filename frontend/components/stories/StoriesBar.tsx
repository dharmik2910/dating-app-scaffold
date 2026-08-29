'use client';

import React, { useRef, useEffect } from 'react';
import { IconPlus, IconUser, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export interface StoryItem {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewed?: boolean;
  viewCount?: number;
}

export interface StoryUserGroup {
  userId: string;
  userName: string;
  userPhoto: string | null;
  isSelf: boolean;
  hasUnseen: boolean;
  latestCreatedAt: string;
  stories: StoryItem[];
}

interface StoriesBarProps {
  groups: StoryUserGroup[];
  loading?: boolean;
  onOpenViewer: (userIndex: number) => void;
  onOpenUpload: () => void;
}

export default function StoriesBar({
  groups,
  loading = false,
  onOpenViewer,
  onOpenUpload,
}: StoriesBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Background prefetch first stories of each user for instant opening
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    groups.forEach((group) => {
      const firstMedia = group.stories?.[0]?.mediaUrl;
      if (firstMedia && group.stories?.[0]?.mediaType !== 'video') {
        const img = new Image();
        img.src = firstMedia;
      }
    });
  }, [groups]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const selfGroup = groups.find((g) => g.isSelf);
  const otherGroups = groups.filter((g) => !g.isSelf);

  return (
    <div className="relative w-full mb-4 select-none">
      {/* Scroll Arrows on Desktop */}
      <button
        type="button"
        onClick={() => scroll('left')}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-neutral-900/95 border border-neutral-700/90 text-white items-center justify-center shadow-xl hover:bg-rose-600 transition-all opacity-90 hover:opacity-100 hover:scale-110 cursor-pointer"
        title="Scroll left"
      >
        <IconChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => scroll('right')}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-neutral-900/95 border border-neutral-700/90 text-white items-center justify-center shadow-xl hover:bg-rose-600 transition-all opacity-90 hover:opacity-100 hover:scale-110 cursor-pointer"
        title="Scroll right"
      >
        <IconChevronRight size={18} />
      </button>

      {/* Stories Tray Scroll Container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 sm:gap-5 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* 1. Self Story / Add Story Item */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
          <div className="relative">
            {selfGroup && selfGroup.stories.length > 0 ? (
              <div
                onClick={() => {
                  const idx = groups.findIndex((g) => g.isSelf);
                  if (idx !== -1) onOpenViewer(idx);
                }}
                className={`p-[2.5px] rounded-full transition-transform duration-300 group-hover:scale-105 ${
                  selfGroup.hasUnseen
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                    : 'bg-gradient-to-tr from-rose-500/80 to-purple-600/80'
                }`}
              >
                <div className="p-0.5 bg-neutral-950 rounded-full">
                  <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden bg-neutral-800 relative">
                    {selfGroup.userPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selfGroup.userPhoto}
                        alt="Your Story"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-800">
                        <IconUser size={30} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={onOpenUpload}
                className="p-[2.5px] rounded-full bg-neutral-800 group-hover:bg-rose-500/50 transition-all duration-300 group-hover:scale-105"
              >
                <div className="p-0.5 bg-neutral-950 rounded-full">
                  <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden bg-neutral-800 relative flex items-center justify-center">
                    <IconUser size={30} className="text-neutral-500" />
                  </div>
                </div>
              </div>
            )}

            {/* Plus badge to add story */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUpload();
              }}
              title="Add Story"
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 border-2 border-neutral-950 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
            >
              <IconPlus size={14} stroke={3} />
            </button>
          </div>
          <span className="text-[11px] font-semibold text-neutral-300 mt-1.5 truncate max-w-[76px] text-center">
            {selfGroup && selfGroup.stories.length > 0 ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Loading Skeletons */}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center flex-shrink-0 animate-pulse">
              <div className="w-[70px] h-[70px] rounded-full bg-neutral-800/80 border border-neutral-700/40" />
              <div className="w-12 h-2.5 bg-neutral-800 rounded-full mt-2" />
            </div>
          ))}

        {/* 2. Other Users' Stories */}
        {!loading &&
          otherGroups.map((group) => {
            const globalIndex = groups.findIndex((g) => g.userId === group.userId);
            const isUnseen = group.hasUnseen;

            return (
              <div
                key={group.userId}
                onClick={() => onOpenViewer(globalIndex)}
                className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
              >
                <div
                  className={`p-[2.5px] rounded-full transition-transform duration-300 group-hover:scale-105 ${
                    isUnseen
                      ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shadow-[0_0_14px_rgba(244,63,94,0.45)] animate-in fade-in'
                      : 'bg-neutral-700/80 group-hover:bg-neutral-600'
                  }`}
                >
                  <div className="p-0.5 bg-neutral-950 rounded-full">
                    <div className="w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-full overflow-hidden bg-neutral-800 relative">
                      {group.userPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={group.userPhoto}
                          alt={group.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-800">
                          <IconUser size={30} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] mt-1.5 truncate max-w-[76px] text-center font-medium ${
                    isUnseen ? 'text-white font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {group.userName.split(' ')[0]}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
