'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  IconSquare,
  IconLayoutGrid,
  IconGridDots,
  IconList,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconCompass,
  IconCircleCheckFilled,
  IconMessageCircle2,
  IconSearch,
  IconFlame,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import DiscoverSkeleton from '@/components/DiscoverSkeleton';
import StoriesBar, { StoryUserGroup } from '@/components/stories/StoriesBar';
import StoryViewerModal from '@/components/stories/StoryViewerModal';
import StoryUploadModal from '@/components/stories/StoryUploadModal';

type ViewMode = 'grid5' | 'grid3' | 'grid2' | 'grid1' | 'list';

const PAGE_SIZE = 15;

type Candidate = {
  userId: string;
  name: string;
  bio?: string;
  distance_km: number;
  latitude?: number;
  longitude?: number;
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
  if (!rawBio) return { cleanBio: '', interests: [] as string[], city: '' };
  let cleanBio = rawBio;
  let city = '';
  let interests: string[] = [];

  const cityMatch = cleanBio.match(/\[CITY:(.*?)\]/);
  if (cityMatch && cityMatch[1]) {
    city = cityMatch[1].trim();
    cleanBio = cleanBio.replace(/\[CITY:.*?\]/, '');
  }

  const intMatch = cleanBio.match(/\[INTERESTS:(.*?)\]/);
  if (intMatch && intMatch[1]) {
    interests = intMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    cleanBio = cleanBio.replace(/\[INTERESTS:.*?\]/, '');
  }

  return { cleanBio: cleanBio.trim(), interests, city };
}

const cityLookupCache: Record<string, string> = {};

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
  const [candidateCities, setCandidateCities] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
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

  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Stories feature states
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [storiesLoading, setStoriesLoading] = useState<boolean>(true);
  const [activeStoryUserIdx, setActiveStoryUserIdx] = useState<number | null>(null);
  const [isUploadStoryOpen, setIsUploadStoryOpen] = useState<boolean>(false);

  // Debounce search query input (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function resolveCitiesForCandidates(items: Candidate[]) {
    const toLookup = items.filter((c) => {
      const { city } = parseBioContent(c.bio);
      return !city && c.latitude != null && c.longitude != null;
    });

    if (toLookup.length === 0) return;

    for (const c of toLookup) {
      const key = `${c.latitude!.toFixed(3)},${c.longitude!.toFixed(3)}`;
      if (cityLookupCache[key]) {
        setCandidateCities((prev) => ({ ...prev, [c.userId]: cityLookupCache[key] }));
        continue;
      }

      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.latitude}&longitude=${c.longitude}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          const city = data.city || data.locality || data.principalSubdivision;
          const country = data.countryName || data.countryCode;
          const label = city ? (country ? `${city}, ${country}` : city) : '';
          if (label) {
            cityLookupCache[key] = label;
            setCandidateCities((prev) => ({ ...prev, [c.userId]: label }));
          }
        }
      } catch (err) {
        console.warn('Async city lookup error:', err);
      }
    }
  }

  useEffect(() => {
    fetchCandidates(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchStories();

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

  function fetchCandidates(queryText?: string) {
    setHasScrolled(false);
    const isSearchTrigger = Boolean(queryText);
    if (isSearchTrigger) {
      setIsSearching(true);
    } else {
      setLoading(true);
    }

    api
      .getDiscovery(undefined, PAGE_SIZE, queryText)
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || [];
        setCandidates(items);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));

        const photoUrls = items.flatMap((c: Candidate) => (c.photos || []).map((p: any) => p.url)).filter(Boolean);
        preloadImages(photoUrls);

        queryCandidatesPresence(items);
        resolveCitiesForCandidates(items);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
        setIsSearching(false);
      });
  }

  const loadMoreCandidates = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getDiscovery(nextCursor, PAGE_SIZE, debouncedSearchQuery || undefined);
      const items = Array.isArray(data) ? data : data.items || [];
      setCandidates((prev) => [...prev, ...items]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));

      const photoUrls = items.flatMap((c: Candidate) => (c.photos || []).map((p: any) => p.url)).filter(Boolean);
      preloadImages(photoUrls);

      queryCandidatesPresence(items);
      resolveCitiesForCandidates(items);
    } catch (err) {
      console.error('Failed to load more candidates:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, debouncedSearchQuery]);

  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 30) {
        setHasScrolled(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Automatic infinite scroll only when user actively scrolls near bottom
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && hasScrolled) {
          loadMoreCandidates();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, hasScrolled, loadMoreCandidates]);

  async function handleToggleLike(candidate: Candidate) {
    const isCurrentlyLiked = !!candidate.liked;
    const nextLikedState = !isCurrentlyLiked;

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
          description: 'You can now chat anytime in Matches',
          action: {
            label: 'Open Chat',
            onClick: () => handleStartChat(candidate),
          },
        });
      } else {
        await api.swipe(candidate.userId, 'UNLIKE');
        toast.info(`Match removed for ${candidate.name}`);
      }
    } catch (err) {
      console.error(err);
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
      const res = await api.swipe(candidate.userId, 'LIKE');
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
    <main className="w-full px-4 sm:px-8 py-6 min-h-[calc(100vh-4rem)] flex flex-col relative">
      {/* Top Header & Discovery Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/20">
              <IconCompass size={22} className="stroke-[2.2]" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Discover
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Explore active profiles nearby, connect instantly, and start meaningful conversations.
          </p>
        </div>

        {/* Toolbar Controls (Single Line on All Screens) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 w-full md:w-auto flex-nowrap">
          {/* Production Search Bar */}
          <div className="relative flex-1 min-w-0 sm:w-64 md:w-72">
            <IconSearch
              size={15}
              className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search profiles"
              className="w-full bg-neutral-900/90 hover:bg-neutral-900 border border-neutral-800 focus:border-rose-500/60 text-white placeholder-neutral-500 text-xs font-medium pl-8 sm:pl-9 pr-6 sm:pr-8 py-2 sm:py-2.5 rounded-2xl outline-none transition-all shadow-inner focus:ring-2 focus:ring-rose-500/20"
            />
            {isSearching ? (
              <div className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin pointer-events-none" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Clear search"
              >
                <IconX size={12} />
              </button>
            ) : null}
          </div>

          {/* Status Filter Pill Selector */}
          <div className="flex items-center p-0.5 sm:p-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <span className="hidden sm:inline">All ({candidates.length})</span>
              <span className="sm:hidden">All</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('online')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === 'online'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-emerald-400'
                }`}
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">Online ({onlineCount})</span>
              <span className="sm:hidden font-semibold">{onlineCount}</span>
            </button>
          </div>

          {/* View Mode Switcher (Visible on mobile & desktop) */}
          <div className="flex items-center p-0.5 sm:p-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl shrink-0">
            {/* Dense 5-Col Grid Option (Desktop only) */}
            <button
              type="button"
              onClick={() => setViewMode('grid5')}
              title="Expanded Grid (5 columns)"
              className={`hidden md:block p-1.5 rounded-xl transition-all ${viewMode === 'grid5' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconGridDots size={16} />
            </button>
            {/* Full Card View Option (Mobile only) */}
            <button
              type="button"
              onClick={() => setViewMode('grid1')}
              title="Full Card View"
              className={`md:hidden p-1.5 rounded-xl transition-all ${viewMode === 'grid1' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconSquare size={15} />
            </button>
            {/* Standard Grid Option */}
            <button
              type="button"
              onClick={() => setViewMode('grid3')}
              title="Standard Grid"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid3' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconLayoutGrid size={15} />
            </button>
            {/* List View Option */}
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
            >
              <IconList size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Stories Tray */}
      <StoriesBar
        groups={storyGroups}
        loading={storiesLoading}
        onOpenViewer={(idx) => setActiveStoryUserIdx(idx)}
        onOpenUpload={() => setIsUploadStoryOpen(true)}
      />

      {/* Main Discover Grid / List Feed */}
      {loading ? (
        <DiscoverSkeleton viewMode={viewMode} />
      ) : displayedCandidates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center p-8 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl max-w-sm backdrop-blur-md">
            {debouncedSearchQuery ? (
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/20">
                <IconSearch size={24} />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
                <IconSparkles size={24} />
              </div>
            )}
            <h3 className="text-base font-bold text-white">
              {debouncedSearchQuery
                ? `No results for "${debouncedSearchQuery}"`
                : statusFilter === 'online'
                  ? 'No Online Users Right Now'
                  : statusFilter === 'offline'
                    ? 'No Offline Users'
                    : 'No Profiles Found'}
            </h3>
            <p className="text-neutral-400 text-xs mt-1.5 leading-relaxed">
              {debouncedSearchQuery
                ? 'Try checking for typos or searching by a different name, hobby, or keyword.'
                : statusFilter !== 'all'
                  ? `There are no users currently ${statusFilter}. Try switching back to All.`
                  : 'No profiles available right now. Check back later or refresh feed.'}
            </p>
            {debouncedSearchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-rose-950/40 cursor-pointer"
              >
                Clear Search
              </button>
            ) : statusFilter !== 'all' ? (
              <button
                onClick={() => setStatusFilter('all')}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-rose-950/40 cursor-pointer"
              >
                Show All Users ({candidates.length})
              </button>
            ) : (
              <button
                onClick={() => fetchCandidates()}
                className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Refresh Feed
              </button>
            )}
          </div>
        </div>
      ) : (
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
          {displayedCandidates.map((candidate) => {
            const { cleanBio, interests, city } = parseBioContent(candidate.bio);
            const candidateCity = city || candidateCities[candidate.userId] || '';
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
                className={`group relative bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-700 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)] rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer ${viewMode === 'list'
                    ? 'flex flex-row items-center p-2.5 sm:p-3 gap-3 sm:gap-4 w-full'
                    : 'w-full aspect-[3/4] flex flex-col'
                  }`}
              >
                {/* Photo & Cover Container */}
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
                  className={`bg-neutral-950 overflow-hidden ${viewMode === 'list'
                      ? `relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shrink-0 ${activity.statusText === 'Online now'
                        ? 'ring-2 ring-emerald-500/80'
                        : 'ring-1 ring-neutral-700/60'
                      }`
                      : 'relative w-full h-full absolute inset-0'
                    }`}
                >
                  {/* Photo Progress Bars */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <div className="absolute top-2 inset-x-2 sm:top-2.5 sm:inset-x-3 flex gap-1 z-30 pointer-events-none">
                      {photosList.map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className={`h-0.5 sm:h-1 flex-1 rounded-full transition-all duration-300 ${idx === activePhotoIdx ? 'bg-white shadow' : 'bg-white/30'
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
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                      <IconUser size={48} stroke={1.5} />
                    </div>
                  )}

                  {/* Clean Scrim Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                  {/* Top Left Live Status Pill - Online Only on Grid Views */}
                  {viewMode !== 'list' && activity.statusText === 'Online now' && (
                    <div className="absolute top-2 left-2 sm:top-3.5 sm:left-3.5 z-20 flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/60 border border-emerald-500/30 backdrop-blur-md">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] sm:text-[10px] font-semibold tracking-wide text-emerald-300">
                        Online
                      </span>
                    </div>
                  )}

                  {/* Subtle online status indicator dot on avatar in list view */}
                  {viewMode === 'list' && activity.statusText === 'Online now' && (
                    <span className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full z-20 shadow-md" />
                  )}

                  {/* Left / Right Photo Arrows for Card */}
                  {photosList.length > 1 && viewMode !== 'list' && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleCardPhoto(candidate.userId, photosList.length, 'prev');
                        }}
                        className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full bg-black/50 border border-white/15 text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-lg hover:scale-110"
                        title="Previous photo"
                        aria-label="Previous photo"
                      >
                        <IconChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleCardPhoto(candidate.userId, photosList.length, 'next');
                        }}
                        className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full bg-black/50 border border-white/15 text-white hover:bg-rose-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-lg hover:scale-110"
                        title="Next photo"
                        aria-label="Next photo"
                      >
                        <IconChevronRight size={14} />
                      </button>
                    </>
                  )}

                  {/* Clean Match Heart Action */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike(candidate);
                    }}
                    title={candidate.liked ? 'Matched! Click to unmatch' : 'Click to match'}
                    aria-label={`Match ${candidate.name}`}
                    className={`absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-20 transition-all duration-300 transform hover:scale-110 active:scale-90 cursor-pointer drop-shadow-md ${viewMode === 'list' ? 'hidden' : ''
                      } ${candidate.liked
                        ? 'text-rose-500 opacity-100 drop-shadow-[0_2px_12px_rgba(244,63,94,0.8)]'
                        : 'text-white/90 hover:text-rose-400 opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
                      }`}
                  >
                    {candidate.liked ? (
                      <IconHeartFilled size={22} className="animate-pulse text-rose-500 sm:w-6 sm:h-6" />
                    ) : (
                      <IconHeart size={22} className="stroke-[2.2] sm:w-6 sm:h-6" />
                    )}
                  </button>

                  {/* Candidate Information Bottom Overlay */}
                  <div
                    className={
                      viewMode === 'list'
                        ? 'hidden'
                        : 'absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 text-white pointer-events-none z-20'
                    }
                  >
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <h3 className="text-xs sm:text-base font-bold tracking-tight truncate text-white">
                        {candidate.name}
                      </h3>
                      <IconCircleCheckFilled size={13} className="text-rose-400 shrink-0 sm:w-4 sm:h-4" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-neutral-300/90 mt-0.5">
                      <IconMapPin size={11} className="text-rose-400 shrink-0" />
                      <span className="truncate font-medium">
                        {candidateCity
                          ? `${candidateCity}${candidate.distance_km != null && candidate.distance_km > 0 ? ` • ${candidate.distance_km.toFixed(1)} km` : ''}`
                          : candidate.distance_km != null && candidate.distance_km > 0
                            ? `${candidate.distance_km.toFixed(1)} km`
                            : 'Nearby'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* List View Details */}
                {viewMode === 'list' && (
                  <div className="flex-1 flex items-center justify-between min-w-0 pr-1 z-10">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-1.5">
                          <span>{candidate.name}</span>
                          <IconCircleCheckFilled size={15} className="text-rose-400 shrink-0" />
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${activity.statusText === 'Online now'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400'
                            }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${activity.dotClass}`} />
                          <span>{activity.statusText}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <IconMapPin size={12} className="text-rose-400 shrink-0" />
                        <span className="truncate font-medium">
                          {candidateCity
                            ? `${candidateCity}${candidate.distance_km != null && candidate.distance_km > 0 ? ` • ${candidate.distance_km.toFixed(1)} km away` : ''}`
                            : candidate.distance_km != null && candidate.distance_km > 0
                              ? `${candidate.distance_km.toFixed(1)} km away`
                              : 'Nearby'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(candidate);
                      }}
                      title={candidate.liked ? 'Matched! Click to unmatch' : 'Click to match'}
                      className={`p-2.5 rounded-2xl border transition-all ml-2.5 shrink-0 cursor-pointer active:scale-90 ${candidate.liked
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-500 shadow-sm'
                        : 'bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700/60 text-neutral-400 hover:text-rose-400'
                        }`}
                    >
                      {candidate.liked ? (
                        <IconHeartFilled size={20} className="text-rose-500 animate-pulse" />
                      ) : (
                        <IconHeart size={20} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
      <div ref={observerTarget} className="w-full h-8 pointer-events-none" />

      {/* Skeleton Loading on Scroll Down */}
      {loadingMore && (
        <div className="mt-4">
          <DiscoverSkeleton viewMode={viewMode} count={viewMode === 'grid5' ? 5 : viewMode === 'grid3' ? 3 : 2} />
        </div>
      )}

      {/* Pagination Load More */}
      {hasMore && !loadingMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMoreCandidates}
            className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs rounded-full shadow-lg transition-all cursor-pointer"
          >
            Load More Profiles
          </button>
        </div>
      )}

      {/* Production-Grade Candidate Profile Detail Modal */}
      {selectedCandidate && (() => {
        const { cleanBio, interests, city: modalCityFromBio } = parseBioContent(selectedCandidate.bio);
        const modalCity = modalCityFromBio || candidateCities[selectedCandidate.userId] || '';
        const photosList = selectedCandidate.photos && selectedCandidate.photos.length > 0
          ? selectedCandidate.photos
          : [];
        const currentPhotoUrl = photosList[Math.min(currentPhotoIndex, photosList.length - 1)]?.url;
        const modalActivity = formatUserActivity(selectedCandidate.userId, null, onlineUserIds, lastActiveMap);

        return (
          <div
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCandidate(null);
            }}
          >
            <div className="relative w-full max-w-lg md:max-w-3xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col md:flex-row max-h-[92vh] md:h-[540px] overflow-y-auto md:overflow-hidden my-auto">

              {/* Close Button */}
              <button
                onClick={() => setSelectedCandidate(null)}
                className="absolute top-3.5 right-3.5 z-40 p-2 rounded-full bg-black/60 border border-white/10 text-white/80 hover:text-white hover:bg-black/90 transition-all cursor-pointer backdrop-blur-md shadow-lg"
                title="Close modal"
              >
                <IconX size={18} />
              </button>

              {/* LEFT HALF / TOP ON MOBILE: Interactive Photo Showcase */}
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
                className="relative w-full md:w-1/2 aspect-[4/5] md:aspect-auto md:h-full bg-neutral-950 shrink-0 overflow-hidden group select-none"
              >
                {/* Photo Story Bars */}
                {photosList.length > 1 && (
                  <div className="absolute top-3 inset-x-3 flex gap-1 z-30 pointer-events-none">
                    {photosList.map((_: any, idx: number) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'bg-white shadow' : 'bg-white/30'
                          }`}
                      />
                    ))}
                  </div>
                )}

                {currentPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPhotoUrl}
                    alt={selectedCandidate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-600 min-h-[300px]">
                    <IconUser size={64} stroke={1.5} />
                  </div>
                )}

                {/* Left/Right Photo Browsing Arrows */}
                {photosList.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photosList.length - 1));
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 border border-white/10 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md transition-all z-20 cursor-pointer shadow-lg hover:scale-105"
                      title="Previous photo"
                    >
                      <IconChevronLeft size={18} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex((prev) => (prev < photosList.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 border border-white/10 text-white/90 hover:text-white hover:bg-rose-500 backdrop-blur-md transition-all z-20 cursor-pointer shadow-lg hover:scale-105"
                      title="Next photo"
                    >
                      <IconChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Photo Badge Count */}
                {photosList.length > 1 && (
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-white/90 backdrop-blur-md z-20">
                    {currentPhotoIndex + 1} / {photosList.length}
                  </div>
                )}
              </div>

              {/* RIGHT HALF / BOTTOM ON MOBILE: Profile Details & Sticky Actions */}
              <div className="w-full md:w-1/2 flex flex-col justify-between md:overflow-y-auto bg-neutral-900 text-white">
                <div className="p-5 sm:p-6 md:p-7 space-y-4">
                  {/* Name, Verified Badge & Status */}
                  <div className="pr-8">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight text-white truncate">
                        {selectedCandidate.name}
                      </h2>
                      <IconCircleCheckFilled size={20} className="text-rose-400 shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {/* Location Pill */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-neutral-300 text-xs font-medium">
                        <IconMapPin size={13} className="text-rose-400 shrink-0" />
                        <span>
                          {modalCity
                            ? `${modalCity}${selectedCandidate.distance_km != null && selectedCandidate.distance_km > 0
                              ? ` • ${selectedCandidate.distance_km.toFixed(1)} km away`
                              : ''
                            }`
                            : selectedCandidate.distance_km != null && selectedCandidate.distance_km > 0
                              ? `${selectedCandidate.distance_km.toFixed(1)} km away`
                              : 'Nearby'}
                        </span>
                      </span>

                      {/* Online Status Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-xs font-medium">
                        <span className={`w-2 h-2 rounded-full ${modalActivity.dotClass}`} />
                        <span className={modalActivity.textClass}>{modalActivity.statusText}</span>
                      </span>
                    </div>
                  </div>

                  {/* Clean Hinge-Style About Card */}
                  {cleanBio && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        About
                      </span>
                      <div className="bg-neutral-800/40 border border-neutral-700/40 p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm text-neutral-200 leading-relaxed break-words">
                        {cleanBio}
                      </div>
                    </div>
                  )}

                  {/* Passions / Interests Chips */}
                  {interests.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        Passions
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {interests.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-xs font-medium text-neutral-300 shadow-sm"
                          >
                            {INTEREST_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Bottom Action Footer */}
                <div className="sticky bottom-0 bg-neutral-900/95 backdrop-blur-md p-4 sm:p-5 border-t border-neutral-800/80 mt-auto flex items-center gap-3 z-30">
                  {/* Match Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleLike(selectedCandidate)}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.98] ${selectedCandidate.liked
                      ? 'bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 shadow-rose-950/20'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white shadow-rose-500/25'
                      }`}
                  >
                    {selectedCandidate.liked ? (
                      <>
                        <IconHeartFilled size={18} className="text-rose-500 shrink-0" />
                        <span>Matched</span>
                      </>
                    ) : (
                      <>
                        <IconHeart size={18} className="stroke-[2.2] shrink-0" />
                        <span>Match</span>
                      </>
                    )}
                  </button>

                  {/* Chat Now Button */}
                  <button
                    type="button"
                    onClick={() => handleStartChat(selectedCandidate)}
                    disabled={startingChat}
                    className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    <IconMessageCircle2 size={18} className="text-rose-400 shrink-0" />
                    <span>{startingChat ? 'Connecting...' : 'Chat Now'}</span>
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
