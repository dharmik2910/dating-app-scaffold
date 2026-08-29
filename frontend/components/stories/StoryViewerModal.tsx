'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconEye,
  IconHeart,
  IconSend,
  IconUser,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { StoryUserGroup, StoryItem } from './StoriesBar';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

interface StoryViewerModalProps {
  groups: StoryUserGroup[];
  initialUserIndex: number;
  onClose: () => void;
  onStoryDeleted?: (storyId: string) => void;
}

interface ViewerItem {
  viewerId: string;
  viewedAt: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  age: number | null;
}

const STORY_DURATION_MS = 5000;

export default function StoryViewerModal({
  groups,
  initialUserIndex,
  onClose,
  onStoryDeleted,
}: StoryViewerModalProps) {
  const [currentUserIdx, setCurrentUserIdx] = useState<number>(initialUserIndex);
  const [currentStoryIdx, setCurrentStoryIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [replyText, setReplyText] = useState<string>('');
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Viewers list state (Instagram style)
  const [showViewers, setShowViewers] = useState<boolean>(false);
  const [viewersList, setViewersList] = useState<ViewerItem[]>([]);
  const [loadingViewers, setLoadingViewers] = useState<boolean>(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isMediaLoaded, setIsMediaLoaded] = useState<boolean>(false);

  const currentGroup = groups[currentUserIdx];
  const currentStory: StoryItem | undefined = currentGroup?.stories?.[currentStoryIdx];

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  // Preload upcoming media images for instant transitions
  useEffect(() => {
    if (!currentGroup) return;
    const storiesToPreload: string[] = [];

    // Next story in current group
    if (currentGroup.stories[currentStoryIdx + 1]?.mediaUrl) {
      storiesToPreload.push(currentGroup.stories[currentStoryIdx + 1].mediaUrl);
    }
    // First story of next group
    if (groups[currentUserIdx + 1]?.stories?.[0]?.mediaUrl) {
      storiesToPreload.push(groups[currentUserIdx + 1].stories[0].mediaUrl);
    }

    storiesToPreload.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [currentGroup, currentStoryIdx, currentUserIdx, groups]);

  // Reset media loaded state when active story changes + safety timeout
  useEffect(() => {
    setIsMediaLoaded(false);
    // Fallback: if browser cache already decoded image or event didn't trigger
    const timeout = setTimeout(() => {
      setIsMediaLoaded(true);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [currentStory?.id]);

  // Fetch viewers when viewing self story or opening viewers drawer
  const fetchViewers = async (storyId: string) => {
    try {
      setLoadingViewers(true);
      const res = await api.getStoryViewers(storyId);
      setViewersList(res || []);
      if (currentStory && res) {
        currentStory.viewCount = res.length;
      }
    } catch (err) {
      console.error('Failed to fetch story viewers', err);
    } finally {
      setLoadingViewers(false);
    }
  };

  // Auto-fetch viewer count for self story whenever active story changes & listen to live view events
  useEffect(() => {
    if (currentGroup?.isSelf && currentStory?.id) {
      fetchViewers(currentStory.id);

      const socket = getSocket();
      const handleLiveView = (data: { storyId: string; viewerId: string }) => {
        if (data.storyId === currentStory.id) {
          fetchViewers(currentStory.id);
        }
      };

      socket.on('storyViewed', handleLiveView);
      return () => {
        socket.off('storyViewed', handleLiveView);
      };
    }
  }, [currentGroup?.isSelf, currentStory?.id]);

  const openViewersSheet = () => {
    if (!currentStory || !currentGroup.isSelf) return;
    handlePause();
    setShowViewers(true);
    fetchViewers(currentStory.id);
  };

  const closeViewersSheet = () => {
    setShowViewers(false);
    handleResume();
  };

  // Navigate to Next Story
  const goToNextStory = useCallback(() => {
    if (!currentGroup) return;
    setShowViewers(false);
    if (currentStoryIdx < currentGroup.stories.length - 1) {
      setCurrentStoryIdx((prev) => prev + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else if (currentUserIdx < groups.length - 1) {
      // Go to next user
      setCurrentUserIdx((prev) => prev + 1);
      setCurrentStoryIdx(0);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      // Reached the end of all stories
      onClose();
    }
  }, [currentGroup, currentStoryIdx, currentUserIdx, groups.length, onClose]);

  // Navigate to Previous Story
  const goToPrevStory = useCallback(() => {
    setShowViewers(false);
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx((prev) => prev - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else if (currentUserIdx > 0) {
      // Go to previous user's last story
      const prevUser = groups[currentUserIdx - 1];
      setCurrentUserIdx((prev) => prev - 1);
      setCurrentStoryIdx(Math.max(0, (prevUser?.stories?.length || 1) - 1));
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    }
  }, [currentStoryIdx, currentUserIdx, groups]);

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !currentStory.viewed && !currentGroup.isSelf) {
      api.markStoryViewed(currentStory.id).catch((err) => {
        console.error('Failed to mark story viewed', err);
      });
      currentStory.viewed = true;
    }
  }, [currentStory, currentGroup]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          handleResume();
        } else if (showViewers) {
          closeViewersSheet();
        } else {
          onClose();
        }
      }
      if (!showViewers && !showDeleteConfirm) {
        if (e.key === 'ArrowRight') goToNextStory();
        if (e.key === 'ArrowLeft') goToPrevStory();
        if (e.key === ' ') setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextStory, goToPrevStory, onClose, showViewers, showDeleteConfirm]);

  // Handle Progress Timer (only progress when media is actually loaded/ready)
  useEffect(() => {
    if (isPaused || !currentStory || showViewers || showDeleteConfirm || !isMediaLoaded) return;

    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;
    const intervalMs = 50;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= STORY_DURATION_MS) {
        clearInterval(progressIntervalRef.current!);
        goToNextStory();
      }
    }, intervalMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentStory, currentStoryIdx, currentUserIdx, isPaused, showViewers, showDeleteConfirm, isMediaLoaded, goToNextStory]);

  const handlePause = () => {
    if (!isPaused) {
      elapsedBeforePauseRef.current = (progress / 100) * STORY_DURATION_MS;
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (isPaused && !showViewers && !showDeleteConfirm) {
      setIsPaused(false);
    }
  };

  const promptDeleteStory = () => {
    handlePause();
    setShowDeleteConfirm(true);
  };

  const cancelDeleteStory = () => {
    setShowDeleteConfirm(false);
    handleResume();
  };

  const confirmDeleteStory = async () => {
    if (!currentStory) return;
    try {
      setIsDeleting(true);
      await api.deleteStory(currentStory.id);
      toast.success('Story deleted');
      setShowDeleteConfirm(false);
      if (onStoryDeleted) onStoryDeleted(currentStory.id);

      // Remove from state
      currentGroup.stories.splice(currentStoryIdx, 1);
      if (currentGroup.stories.length === 0) {
        if (groups.length <= 1) {
          onClose();
        } else {
          goToNextStory();
        }
      } else {
        setCurrentStoryIdx((prev) => Math.min(prev, currentGroup.stories.length - 1));
        setProgress(0);
        elapsedBeforePauseRef.current = 0;
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete story');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendReaction = async (reaction: string) => {
    if (!currentGroup || currentGroup.isSelf) return;
    try {
      setSendingReply(true);
      await api.swipe(currentGroup.userId, 'LIKE');
      toast.success(`Sent reaction ${reaction} to ${currentGroup.userName}!`);
    } catch (e) {
      console.error(e);
      toast.error('Could not send reaction');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentGroup) return;

    try {
      setSendingReply(true);
      // Auto-like / match if needed
      await api.swipe(currentGroup.userId, 'LIKE');
      toast.success(`Reply sent to ${currentGroup.userName}!`);
      setReplyText('');
      setIsPaused(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  if (!currentGroup || !currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center select-none animate-in fade-in duration-200">
      {/* Desktop Prev / Next User Buttons */}
      <button
        type="button"
        onClick={goToPrevStory}
        className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-neutral-900/80 border border-neutral-700 text-white hover:bg-neutral-800 transition-all hover:scale-110"
        title="Previous Story"
      >
        <IconChevronLeft size={28} />
      </button>
      <button
        type="button"
        onClick={goToNextStory}
        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-neutral-900/80 border border-neutral-700 text-white hover:bg-neutral-800 transition-all hover:scale-110"
        title="Next Story"
      >
        <IconChevronRight size={28} />
      </button>

      {/* Main Story Container (Full Height 9:16 / Viewport on Mobile & Desktop) */}
      <div
        className="relative w-full max-w-md h-full max-h-[100dvh] sm:max-h-[94vh] sm:rounded-3xl bg-black shadow-2xl flex flex-col justify-between overflow-hidden"
        onMouseDown={handlePause}
        onMouseUp={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        {/* 1. STORY MEDIA BACKGROUND (Full Height Bleed) */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {!isMediaLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              onLoadedData={() => setIsMediaLoaded(true)}
              onError={() => setIsMediaLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-150 ${isMediaLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={currentStory.id}
              src={currentStory.mediaUrl}
              alt="Story"
              loading="eager"
              decoding="async"
              onLoad={() => setIsMediaLoaded(true)}
              onError={(e) => {
                console.error('Failed to load story media image:', currentStory.mediaUrl);
                setIsMediaLoaded(true);
              }}
              className={`w-full h-full object-cover transition-opacity duration-150 ${isMediaLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          )}

          {/* Top & Bottom Gradient Shadows for High Readability */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
        </div>

        {/* 2. TAP NAVIGATION ZONES (Left 30% for prev, Right 70% for next) */}
        <div className="absolute inset-0 z-20 flex pointer-events-auto">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevStory();
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              goToNextStory();
            }}
          />
        </div>

        {/* 3. TOP HEADER OVERLAY (Progress Bars & User Profile) */}
        <div className="relative z-40 p-3.5 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-auto">
          {/* Segmented Progress Bars */}
          <div className="flex items-center gap-1.5 mb-3">
            {currentGroup.stories.map((s, idx) => {
              let fillPercent = 0;
              if (idx < currentStoryIdx) fillPercent = 100;
              else if (idx === currentStoryIdx) fillPercent = progress;

              return (
                <div
                  key={s.id}
                  className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Details & Story Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-white/20 shrink-0">
                {currentGroup.userPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentGroup.userPhoto}
                    alt={currentGroup.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400">
                    <IconUser size={20} />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight drop-shadow-md">
                  {currentGroup.isSelf ? 'Your Story' : currentGroup.userName}
                </h4>
                <p className="text-[11px] text-neutral-300 drop-shadow">
                  {new Date(currentStory.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentGroup.isSelf && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openViewersSheet();
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-black/60 hover:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 transition-transform active:scale-95 cursor-pointer shadow-lg"
                    title="View viewers list"
                  >
                    <IconEye size={15} className="text-rose-400" />
                    <span>{viewersList.length || currentStory.viewCount || 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      promptDeleteStory();
                    }}
                    className="p-1.5 rounded-full bg-black/40 hover:bg-rose-600/80 text-white/90 hover:text-white transition-colors cursor-pointer"
                    title="Delete Story"
                  >
                    <IconTrash size={17} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 rounded-full bg-black/40 hover:bg-neutral-800 text-white/90 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <IconX size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 4. BOTTOM OVERLAY: Caption & Quick Reply / Viewers bar */}
        <div className="relative z-40 p-4 space-y-2 pointer-events-auto mt-auto">
          {currentStory.caption && (
            <div className="px-4 py-1.5 max-w-sm mx-auto">
              <p className="text-sm sm:text-base font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] text-center leading-relaxed tracking-wide">
                {currentStory.caption}
              </p>
            </div>
          )}

          {!currentGroup.isSelf && (
            <form onSubmit={handleSendReply} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                placeholder={`Reply to ${currentGroup.userName}...`}
                value={replyText}
                onFocus={handlePause}
                onBlur={handleResume}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-black/60 backdrop-blur-md border border-white/20 focus:border-rose-500 rounded-full px-4 py-2.5 text-xs text-white placeholder-neutral-400 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sendingReply}
                className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 text-white transition-colors cursor-pointer"
              >
                <IconSend size={15} />
              </button>
            </form>
          )}
        </div>

        {/* 5. INSTAGRAM-STYLE VIEWERS BOTTOM SHEET */}
        {showViewers && (
          <div
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              closeViewersSheet();
            }}
          >
            <div
              className="bg-neutral-900 border-t border-neutral-700/80 rounded-t-3xl p-5 max-h-[70%] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Handle & Header */}
              <div className="w-12 h-1.5 bg-neutral-600 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <IconEye size={20} className="text-rose-500" />
                  <h3 className="text-base font-bold text-white">Story Viewers</h3>
                  <span className="text-xs bg-neutral-800 text-neutral-300 font-semibold px-2 py-0.5 rounded-full">
                    {viewersList.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeViewersSheet}
                  className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <IconX size={20} />
                </button>
              </div>

              {/* Viewers List */}
              <div className="overflow-y-auto mt-3 space-y-3 pr-1 max-h-80">
                {loadingViewers ? (
                  <div className="py-8 text-center text-sm text-neutral-400">
                    <div className="inline-block w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading viewers...</p>
                  </div>
                ) : viewersList.length === 0 ? (
                  <div className="py-8 text-center text-neutral-400">
                    <IconEye size={36} className="mx-auto mb-2 text-neutral-600" />
                    <p className="text-sm font-medium">No viewers yet</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      When someone views your story, they will appear here.
                    </p>
                  </div>
                ) : (
                  viewersList.map((viewer) => (
                    <div
                      key={viewer.viewerId}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 shrink-0">
                          {viewer.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={viewer.photoUrl}
                              alt={viewer.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                              <IconUser size={22} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-snug">
                            {viewer.name}
                            {viewer.age ? `, ${viewer.age}` : ''}
                          </p>
                          <p className="text-xs text-neutral-400">
                            Viewed{' '}
                            {new Date(viewer.viewedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. DELETE CONFIRMATION DIALOG */}
        {showDeleteConfirm && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              cancelDeleteStory();
            }}
          >
            <div
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <IconTrash size={24} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Delete Story?</h3>
              <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
                This story will be removed and won&apos;t be visible to anyone anymore.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteStory}
                  className="w-full py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={cancelDeleteStory}
                  className="w-full py-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

