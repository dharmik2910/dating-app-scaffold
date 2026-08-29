'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { usePresenceStore, formatUserActivity } from '@/lib/usePresenceStore';
import {
  IconMapPin,
  IconUser,
  IconSparkles,
  IconHeart,
  IconHeartFilled,
  IconLayoutGrid,
  IconGridDots,
  IconSquare,
  IconList,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconCompass,
  IconWifi,
  IconCircleCheck,
  IconMessageCircle2,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import DiscoverSkeleton from '@/components/DiscoverSkeleton';
import StoriesBar, { StoryUserGroup } from '@/components/stories/StoriesBar';
import StoryViewerModal from '@/components/stories/StoryViewerModal';
import StoryUploadModal from '@/components/stories/StoryUploadModal';

type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

type Candidate = {
  userId: string;
  name: string;
  bio?: string;
  distance_km: number;
  liked?: boolean;
  photos?: { id: string; url: string }[];
};

const INTEREST_LABELS: Record<string, string> = {
  coffee: '☕ Coffee',
  travel: '✈️ Travel',
  fitness: '🏋️‍♂️ Fitness',
  music: '🎧 Music',
  foodie: '🍕 Foodie',
  gaming: '🎮 Gaming',
  art: '🎨 Art',
  photography: '📸 Photography',
  reading: '📚 Reading',
  pets: '🐶 Pets',
  movies: '🎬 Movies',
  tech: '💻 Tech',
  hiking: '🧗‍♂️ Outdoor',
  wine: '🍷 Wine',
};

function parseBioContent(rawBio?: string) {
  if (!rawBio) return { cleanBio: '', interests: [] };
  const match = rawBio.match(/\[INTERESTS:(.*?)\]/);
  if (match && match[1]) {
    const interests = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const cleanBio = rawBio.replace(/\[INTERESTS:.*?\]/, '').trim();
    return { cleanBio, interests };
  }
  return { cleanBio: rawBio.trim(), interests: [] };
}

function preloadImages(urls: (string | undefined)[]) {
  if (typeof window === 'undefined') return;
  urls.forEach((url) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  });
}

export default function DiscoverPage() {
  const router = useRouter();
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const lastActiveMap = usePresenceStore((state) => state.lastActiveMap);
  const setPresenceList = usePresenceStore((state) => state.setPresenceList);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid5');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [modalImgLoading, setModalImgLoading] = useState<boolean>(true);
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({});
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [startingChat, setStartingChat] = useState<boolean>(false);

  // Stories feature states
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [storiesLoading, setStoriesLoading] = useState<boolean>(true);
  const [activeStoryUserIdx, setActiveStoryUserIdx] = useState<number | null>(null);
  const [isUploadStoryOpen, setIsUploadStoryOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchCandidates();
    fetchStories();

    // Listen to real-time story WebSocket events
    const socket = getSocket();
    const handleStoryEvent = () => {
      fetchStories();
    };

    socket.on('storyCreated', handleStoryEvent);
    socket.on('storyDeleted', handleStoryEvent);
    socket.on('storyViewed', handleStoryEvent);

    return () => {
      socket.off('storyCreated', handleStoryEvent);
      socket.off('storyDeleted', handleStoryEvent);
      socket.off('storyViewed', handleStoryEvent);
    };
  }, []);

  function fetchStories() {
    setStoriesLoading(true);
    api
      .getStoriesFeed()
      .then((data) => {
        setStoryGroups(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load stories feed:', err);
      })
      .finally(() => {
        setStoriesLoading(false);
      });
  }

  // Preload and monitor modal photo loading state
  useEffect(() => {
    if (selectedCandidate) {
      const photosList = selectedCandidate.photos || [];
      const currentPhotoUrl = photosList[Math.min(currentPhotoIndex, photosList.length - 1)]?.url;
      if (currentPhotoUrl) {
        const img = new Image();
        img.src = currentPhotoUrl;
        if (img.complete) {
          setModalImgLoading(false);
        } else {
          setModalImgLoading(true);
          img.onload = () => setModalImgLoading(false);
          img.onerror = () => setModalImgLoading(false);
        }
        // Preload rest of this candidate's photos
        preloadImages(photosList.map((p) => p.url));
      } else {
        setModalImgLoading(false);
      }
    }
  }, [selectedCandidate, currentPhotoIndex]);

  function queryCandidatesPresence(candidateList: Candidate[]) {
    const userIds = candidateList.map((c) => c.userId).filter(Boolean);
    if (userIds.length > 0) {
      const socket = getSocket();
      socket.emit('queryPresence', userIds, (response: any[]) => {
        if (Array.isArray(response)) {
          setPresenceList(response);
        }
      });
    }
  }

  function fetchCandidates() {
    setLoading(true);
    api
      .getDiscovery()
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setCandidates(items);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setLoading(false);

        // Preload first batch of photos into browser cache for instant rendering
        const photoUrls = items.flatMap((c: Candidate) => (c.photos || []).map((p: any) => p.url)).filter(Boolean);
        preloadImages(photoUrls);

        // Query real-time presence
        queryCandidatesPresence(items);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  async function loadMoreCandidates() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getDiscovery(nextCursor);
      const items = Array.isArray(data) ? data : data.items || [];
      setCandidates((prev) => [...prev, ...items]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));

      // Preload next batch of photos
      const photoUrls = items.flatMap((c: Candidate) => (c.photos || []).map((p: any) => p.url)).filter(Boolean);
      preloadImages(photoUrls);

      // Query presence for newly appended candidates
      queryCandidatesPresence(items);
    } catch (err) {
      console.error('Failed to load more candidates:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleToggleLike(candidate: Candidate) {
    const isCurrentlyLiked = !!candidate.liked;
    const nextLikedState = !isCurrentlyLiked;

    // Optimistically update UI
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: nextLikedState } : c))
    );
    if (selectedCandidate?.userId === candidate.userId) {
      setSelectedCandidate((prev) => (prev ? { ...prev, liked: nextLikedState } : null));
    }

    try {
      if (nextLikedState) {
        await api.swipe(candidate.userId, 'LIKE');
        toast.success(`Matched with ${candidate.name}! ❤️`, {
          description: 'You can now chat in Matches',
          action: {
            label: 'View Matches',
            onClick: () => (window.location.href = '/matches'),
          },
        });
      } else {
        await api.swipe(candidate.userId, 'UNLIKE');
        toast.info(`Match removed for ${candidate.name}`);
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic update on error
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: isCurrentlyLiked } : c))
      );
      if (selectedCandidate?.userId === candidate.userId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, liked: isCurrentlyLiked } : null));
      }
      toast.error('Failed to update match status. Please try again.');
    }
  }

  async function handleStartChat(candidate: Candidate) {
    setStartingChat(true);
    try {
      // Ensure match is created or retrieved
      const res = await api.swipe(candidate.userId, 'LIKE');
      // Update local state if not already liked
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: true } : c))
      );
      if (selectedCandidate?.userId === candidate.userId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, liked: true } : null));
      }

      if (res?.match?.id) {
        router.push(`/chat/${res.match.id}`);
      } else {
        router.push('/chat');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to start chat. Redirecting to Chat...');
      router.push('/chat');
    } finally {
      setStartingChat(false);
    }
  }

  function openCandidateModal(candidate: Candidate) {
    const initialIndex = cardPhotoIndexes[candidate.userId] || 0;
    setCurrentPhotoIndex(initialIndex);
    setSelectedCandidate(candidate);

    // Immediate preload for candidate photos
    if (candidate.photos && candidate.photos.length > 0) {
      preloadImages(candidate.photos.map((p) => p.url));
    }
  }

  function cycleCardPhoto(userId: string, totalPhotos: number, direction: 'next' | 'prev', e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setCardPhotoIndexes((prev) => {
      const current = prev[userId] || 0;
      const nextIdx =
        direction === 'next'
          ? (current + 1) % totalPhotos
          : (current - 1 + totalPhotos) % totalPhotos;
      return { ...prev, [userId]: nextIdx };
    });
  }

  function handleTouchEnd(e: React.TouchEvent, onNext: () => void, onPrev: () => void) {
    if (touchStartX === null) return;
    const diffX = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 35) {
      if (diffX > 0) {
        onNext();
      } else {
        onPrev();
      }
    }
    setTouchStartX(null);
  }

  // Compute online and offline counts from discovered candidates
  const { onlineCandidates, offlineCandidates, onlineCount, offlineCount } = useMemo(() => {
    const online: Candidate[] = [];
    const offline: Candidate[] = [];

    candidates.forEach((c) => {
      if (onlineUserIds.includes(c.userId)) {
        online.push(c);
      } else {
        offline.push(c);
      }
    });

    return {
      onlineCandidates: online,
      offlineCandidates: offline,
      onlineCount: online.length,
      offlineCount: offline.length,
    };
  }, [candidates, onlineUserIds]);

  const displayedCandidates = useMemo(() => {
    if (statusFilter === 'online') return onlineCandidates;
    if (statusFilter === 'offline') return offlineCandidates;
    return candidates;
  }, [statusFilter, candidates, onlineCandidates, offlineCandidates]);

  return (
    <main className="w-full px-4 sm:px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <IconCompass className="text-rose-500 shrink-0" size={30} />
            <span>Discover People</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Tap or click any profile to view details, or hit the heart to match
          </p>
        </div>

        {/* Controls: View Switcher and Status Dropdown side-by-side */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* View Switcher Dropdown Select */}
          <div className="relative flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-2xl flex-shrink-0">
            <span className="text-xs font-semibold text-neutral-400">View:</span>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer pr-1"
            >
              <option value="grid5" className="bg-neutral-900 text-white hidden xl:block">Expanded Grid</option>
              <option value="grid3" className="bg-neutral-900 text-white hidden md:block">Standard Grid</option>
              <option value="grid2" className="bg-neutral-900 text-white md:hidden">Compact Grid</option>
              <option value="grid1" className="bg-neutral-900 text-white md:hidden">Full Card View</option>
              <option value="list" className="bg-neutral-900 text-white">List View</option>
            </select>
          </div>

          {/* Status Filter Dropdown Select (Beside View Switcher) */}
          <div className="relative flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-2xl flex-shrink-0">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
              {statusFilter === 'online' ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : statusFilter === 'offline' ? (
                <span className="h-2 w-2 rounded-full bg-neutral-500" />
              ) : null}
              <span>Status:</span>
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
              className={`bg-transparent text-xs font-semibold outline-none cursor-pointer pr-1 ${
                statusFilter === 'online'
                  ? 'text-emerald-400 font-bold'
                  : statusFilter === 'offline'
                  ? 'text-neutral-300'
                  : 'text-white'
              }`}
            >
              <option value="all" className="bg-neutral-900 text-white">
                All ({candidates.length})
              </option>
              <option value="online" className="bg-neutral-900 text-emerald-400 font-medium">
                Online ({onlineCount})
              </option>
              <option value="offline" className="bg-neutral-900 text-neutral-300">
                Offline ({offlineCount})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Stories Bar Tray */}
      <StoriesBar
        groups={storyGroups}
        loading={storiesLoading}
        onOpenViewer={(idx) => setActiveStoryUserIdx(idx)}
        onOpenUpload={() => setIsUploadStoryOpen(true)}
      />

      {loading ? (
        <DiscoverSkeleton viewMode={viewMode} />
      ) : displayedCandidates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center p-8 bg-neutral-900/60 border border-neutral-800 rounded-3xl max-w-sm">
            <IconSparkles size={40} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">
              {statusFilter === 'online'
                ? 'No Online Users Right Now'
                : statusFilter === 'offline'
                ? 'No Offline Users'
                : 'No Profiles Found'}
            </h3>
            <p className="text-neutral-400 text-xs mt-1">
              {statusFilter !== 'all'
                ? `There are no users currently ${statusFilter}. Try switching back to All.`
                : 'No profiles available right now. Check back later or refresh feed.'}
            </p>
            {statusFilter !== 'all' ? (
              <button
                onClick={() => setStatusFilter('all')}
                className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Show All Users ({candidates.length})
              </button>
            ) : (
              <button
                onClick={fetchCandidates}
                className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors"
              >
                Refresh Feed
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Dynamic Grid/List Container */
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
          {displayedCandidates.map((candidate) => {
            const { cleanBio, interests } = parseBioContent(candidate.bio);
            const photosList = candidate.photos && candidate.photos.length > 0 ? candidate.photos : [];
            const activePhotoIdx = cardPhotoIndexes[candidate.userId] || 0;
            const currentPhotoUrl = photosList[activePhotoIdx]?.url || photosList[0]?.url;
            const activity = formatUserActivity(candidate.userId, null, onlineUserIds, lastActiveMap);

            return (
              <div
                key={candidate.userId}
                onClick={() => openCandidateModal(candidate)}
                onMouseEnter={() => {
                  if (candidate.photos && candidate.photos.length > 0) {
                    preloadImages(candidate.photos.map((p) => p.url));
                  }
                }}
                className={`group relative bg-neutral-900 border border-neutral-800/80 hover:border-rose-500/50 rounded-3xl overflow-hidden shadow-xl transition-all duration-300 cursor-pointer ${viewMode === 'list'
                  ? 'flex flex-row items-center p-3 gap-4 w-full'
                  : 'flex flex-col w-full'
                  }`}
              >
                {/* Photo & Cover */}
                <div
                  onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                  onTouchEnd={(e) =>
                    photosList.length > 1 &&
                    handleTouchEnd(
                      e,
                      () => cycleCardPhoto(candidate.userId, photosList.length, 'next'),
                      () => cycleCardPhoto(candidate.userId, photosList.length, 'prev')
                    )
                  }
                  className={`relative bg-neutral-800 overflow-hidden ${viewMode === 'list'
                    ? `w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0 ${
                        activity.statusText === 'Online now'
                          ? 'ring-2 ring-emerald-500/80'
                          : 'ring-1 ring-neutral-700/60'
                      }`
                    : 'aspect-[3/4] w-full'
                    }`}
                >
                  {/* Photo Story Progress Bars */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <div className="absolute top-2.5 inset-x-3 flex gap-1 z-30 pointer-events-none">
                      {photosList.map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx === activePhotoIdx ? 'bg-white shadow-md' : 'bg-white/35'
                            }`}
                        />
                      ))}
                    </div>
                  )}

                  {currentPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPhotoUrl}
                      alt={candidate.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                      <IconUser size={64} stroke={1.5} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-90 pointer-events-none" />

                  {/* Left / Right Photo Arrows for Card */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => cycleCardPhoto(candidate.userId, photosList.length, 'prev', e)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                        title="Previous photo"
                      >
                        <IconChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => cycleCardPhoto(candidate.userId, photosList.length, 'next', e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                        title="Next photo"
                      >
                        <IconChevronRight size={16} />
                      </button>
                    </>
                  )}

                  {/* Online / Active Status Badge on Card (Top Left for Grid modes only) */}
                  {viewMode !== 'list' && (
                    <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
                      <span className={`w-2 h-2 rounded-full ${activity.dotClass}`} />
                      <span className={`text-[10px] font-medium ${activity.textClass}`}>
                        {activity.statusText}
                      </span>
                    </div>
                  )}

                  {/* Match Heart Icon - Visible in Grid Modes only */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike(candidate);
                    }}
                    title={candidate.liked ? 'Matched! Click to unmatch' : 'Click heart to match'}
                    aria-label={`Match ${candidate.name}`}
                    className={`absolute top-3.5 right-3.5 z-20 transition-all duration-300 transform active:scale-90 cursor-pointer drop-shadow-md ${viewMode === 'list' ? 'hidden' : ''
                      } ${candidate.liked
                        ? 'text-rose-500 opacity-100 scale-100 drop-shadow-[0_2px_10px_rgba(244,63,94,0.7)]'
                        : 'text-white/90 hover:text-rose-500 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100 hover:drop-shadow-[0_2px_10px_rgba(244,63,94,0.5)]'
                      }`}
                  >
                    {candidate.liked ? (
                      <IconHeartFilled size={28} className="animate-pulse" />
                    ) : (
                      <IconHeart size={28} className="stroke-[2.2] hover:fill-rose-500 transition-colors" />
                    )}
                  </button>

                  {/* Candidate Information Overlay */}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'hidden'
                        : 'absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none'
                    }
                  >
                    <h3 className="text-lg font-bold tracking-wide flex items-center gap-2">
                      <span>{candidate.name}</span>
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-neutral-300 mt-0.5">
                      <IconMapPin size={13} className="text-rose-400" />
                      <span>
                        {candidate.distance_km != null && candidate.distance_km > 0
                          ? `${candidate.distance_km.toFixed(1)} km away`
                          : 'Nearby'}
                      </span>
                    </div>

                    {cleanBio && (
                      <p className="text-xs text-neutral-300/90 mt-1.5 line-clamp-2 leading-relaxed">
                        {cleanBio}
                      </p>
                    )}

                    {/* Interest Pills */}
                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {interests.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-medium backdrop-blur-md text-white"
                          >
                            {INTEREST_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dedicated List View Content Section */}
                {viewMode === 'list' && (
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {candidate.name}
                        </h3>
                        {/* Clean Status Pill with glowing indicator */}
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                            activity.statusText === 'Online now'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${activity.dotClass}`} />
                          <span>{activity.statusText}</span>
                        </span>
                      </div>

                      {/* Distance */}
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-neutral-400">
                        <IconMapPin size={12} className="text-rose-400 shrink-0" />
                        <span className="truncate">
                          {candidate.distance_km != null && candidate.distance_km > 0
                            ? `${candidate.distance_km.toFixed(1)} km away`
                            : 'Nearby'}
                        </span>
                      </div>

                      {cleanBio && (
                        <p className="text-xs text-neutral-300 line-clamp-1 truncate max-w-sm sm:max-w-md">
                          {cleanBio}
                        </p>
                      )}

                      {interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {interests.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md bg-neutral-800/90 border border-neutral-700/60 text-[10px] font-medium text-neutral-300"
                            >
                              {INTEREST_LABELS[tag] || tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(candidate);
                      }}
                      title={candidate.liked ? 'Matched! Click to unmatch' : 'Click heart to match'}
                      className="p-2.5 sm:p-3 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 hover:border-rose-500/50 transition-all ml-2.5 shrink-0 cursor-pointer active:scale-90"
                    >
                      {candidate.liked ? (
                        <IconHeartFilled size={22} className="text-rose-500 animate-pulse" />
                      ) : (
                        <IconHeart size={22} className="text-neutral-400 hover:text-rose-500 transition-colors" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMoreCandidates}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-rose-500/50 text-neutral-200 hover:text-white font-semibold text-xs rounded-full shadow-lg transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Loading profiles...' : 'Load More Profiles'}
          </button>
        </div>
      )}

      {/* Candidate Full Profile Detail Modal */}
      {selectedCandidate && (() => {
        const { cleanBio, interests } = parseBioContent(selectedCandidate.bio);
        const photosList = selectedCandidate.photos && selectedCandidate.photos.length > 0
          ? selectedCandidate.photos
          : [];
        const currentPhotoUrl = photosList[Math.min(currentPhotoIndex, photosList.length - 1)]?.url;
        const modalActivity = formatUserActivity(selectedCandidate.userId, null, onlineUserIds, lastActiveMap);

        return (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-lg flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl bg-neutral-900/95 border border-neutral-800/90 rounded-3xl overflow-y-auto md:overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] my-auto flex flex-col md:flex-row max-h-[85vh] sm:max-h-[90vh] md:h-[540px]">
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedCandidate(null)}
                className="absolute top-3.5 right-3.5 z-40 p-2.5 rounded-full bg-black/60 border border-white/15 text-white/80 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer backdrop-blur-md shadow-lg"
                title="Close"
              >
                <IconX size={20} />
              </button>

              {/* LEFT COLUMN: Photo Gallery (Preserving original 3:4 aspect ratio) */}
              <div
                onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={(e) =>
                  photosList.length > 1 &&
                  handleTouchEnd(
                    e,
                    () => setCurrentPhotoIndex((prev) => (prev < photosList.length - 1 ? prev + 1 : 0)),
                    () => setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photosList.length - 1))
                  )
                }
                className="relative w-full md:w-1/2 aspect-[15/16] md:aspect-auto md:h-full bg-neutral-950 shrink-0 overflow-hidden group select-none cursor-pointer"
              >
                {/* Story Navigation Top Bars */}
                {photosList.length > 1 && (
                  <div className="absolute top-3 inset-x-3 flex gap-1 z-30 pointer-events-none">
                    {photosList.map((_: any, idx: number) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          idx === currentPhotoIndex ? 'bg-white shadow' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {currentPhotoUrl ? (
                  <div className="relative w-full h-full">
                    {/* Shimmer Skeleton & Spinner while image loads */}
                    {modalImgLoading && (
                      <div className="absolute inset-0 bg-neutral-900 animate-pulse flex flex-col items-center justify-center text-neutral-600 z-10">
                        <div className="w-10 h-10 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin mb-2.5" />
                        <span className="text-[11px] text-neutral-400 font-medium">Loading photo...</span>
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={currentPhotoUrl}
                      src={currentPhotoUrl}
                      alt={selectedCandidate.name}
                      loading="eager"
                      decoding="async"
                      onLoad={() => setModalImgLoading(false)}
                      onError={() => setModalImgLoading(false)}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
                        modalImgLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-in fade-in-50'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                    <IconUser size={72} stroke={1.5} />
                  </div>
                )}

                {/* Photo Gallery Left/Right Floating Arrows */}
                {photosList.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photosList.length - 1));
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 border border-white/10 text-white/90 hover:text-white hover:bg-rose-500 hover:scale-110 backdrop-blur-md transition-all z-20 cursor-pointer shadow-lg"
                      title="Previous photo"
                    >
                      <IconChevronLeft size={18} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex((prev) => (prev < photosList.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 border border-white/10 text-white/90 hover:text-white hover:bg-rose-500 hover:scale-110 backdrop-blur-md transition-all z-20 cursor-pointer shadow-lg"
                      title="Next photo"
                    >
                      <IconChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Photo Count Tag */}
                {photosList.length > 1 && (
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-white/90 backdrop-blur-md z-20">
                    {currentPhotoIndex + 1} / {photosList.length}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Candidate Details & Actions */}
              <div className="w-full md:w-1/2 p-5 sm:p-6 md:p-8 flex flex-col justify-between overflow-y-auto space-y-4 bg-neutral-900/90 text-white shrink-0 md:shrink md:overflow-y-auto">
                <div className="space-y-4">
                  {/* Name & Title Row */}
                  <div className="pr-10">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white truncate">
                        {selectedCandidate.name}
                      </h2>
                      {selectedCandidate.liked && (
                        <span className="px-3 py-1 rounded-full text-[11px] sm:text-xs font-extrabold tracking-wide uppercase border border-rose-500/60 bg-rose-950/60 text-rose-300 shadow-sm shadow-rose-950/50 shrink-0">
                          Matched ❤️
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Distance */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                        <IconMapPin size={14} />
                        <span>
                          {selectedCandidate.distance_km != null && selectedCandidate.distance_km > 0
                            ? `${selectedCandidate.distance_km.toFixed(1)} km away`
                            : 'Nearby Profile'}
                        </span>
                      </span>

                      {/* Online / Active Status Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-xs font-semibold">
                        <span className={`w-2 h-2 rounded-full ${modalActivity.dotClass}`} />
                        <span className={modalActivity.textClass}>{modalActivity.statusText}</span>
                      </span>
                    </div>
                  </div>

                  {/* Bio / About */}
                  {cleanBio && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">About</span>
                      <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed bg-neutral-950/80 border-l-4 border-rose-500 border-neutral-800/80 p-3.5 sm:p-4 rounded-2xl shadow-inner break-words">
                        {cleanBio}
                      </p>
                    </div>
                  )}

                  {/* Passions / Interests */}
                  {interests.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Passions</span>
                      <div className="flex flex-wrap gap-1.5">
                        {interests.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-semibold text-neutral-300 shadow-sm"
                          >
                            {INTEREST_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons at Bottom */}
                <div className="pt-3 border-t border-neutral-800/80 mt-auto shrink-0 flex items-center gap-2.5">
                  {/* Match / Unmatch Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleLike(selectedCandidate)}
                    className={`flex-1 py-3.5 sm:py-4 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:scale-[0.98] ${
                      selectedCandidate.liked
                        ? 'bg-neutral-800 border border-rose-500/50 text-rose-400 hover:bg-rose-950/30'
                        : 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:opacity-95 text-white shadow-rose-950/60 hover:shadow-rose-900/80'
                    }`}
                  >
                    {selectedCandidate.liked ? (
                      <>
                        <IconHeartFilled size={18} className="text-rose-500 shrink-0" />
                        <span className="truncate">Matched</span>
                      </>
                    ) : (
                      <>
                        <IconHeart size={18} className="fill-white/20 shrink-0" />
                        <span className="truncate">Match</span>
                      </>
                    )}
                  </button>

                  {/* Direct Chat Button */}
                  <button
                    type="button"
                    onClick={() => handleStartChat(selectedCandidate)}
                    disabled={startingChat}
                    className="flex-1 py-3.5 sm:py-4 px-3 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl bg-gradient-to-r from-neutral-800 to-neutral-700 hover:from-neutral-700 hover:to-neutral-600 border border-neutral-700/80 text-white hover:text-rose-400 active:scale-[0.98] disabled:opacity-50"
                  >
                    <IconMessageCircle2 size={18} className="text-rose-400 shrink-0" />
                    <span className="truncate">{startingChat ? 'Opening Chat...' : 'Chat Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Story Viewer Modal */}
      {activeStoryUserIdx !== null && (
        <StoryViewerModal
          groups={storyGroups}
          initialUserIndex={activeStoryUserIdx}
          onClose={() => setActiveStoryUserIdx(null)}
          onStoryDeleted={() => fetchStories()}
        />
      )}

      {/* Story Upload Modal */}
      {isUploadStoryOpen && (
        <StoryUploadModal
          onClose={() => setIsUploadStoryOpen(false)}
          onStoryUploaded={() => fetchStories()}
        />
      )}
    </main>
  );
}
