'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePresenceStore, formatUserActivity } from '@/lib/usePresenceStore';
import {
  IconMapPin,
  IconSparkles,
  IconHeart,
  IconX,
  IconMessageCircle2,
  IconSearch,
  IconFlame,
  IconBolt,
  IconStar,
  IconEyeOff,
  IconShieldCheck,
  IconFlag,
  IconBan,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconMicrophone,
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import DiscoverSkeleton from '@/components/DiscoverSkeleton';
import StoriesBar, { StoryUserGroup } from '@/components/stories/StoriesBar';
import StoryViewerModal from '@/components/stories/StoryViewerModal';
import StoryUploadModal from '@/components/stories/StoryUploadModal';
import NotificationModal from '@/components/NotificationModal';

type DiscoveryMode = 'all' | 'top_picks' | 'blind_date';

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
  outdoor: '🧗‍♂️ Outdoor',
  wine: '🍷 Wine',
  cooking: '🍳 Cooking',
  nature: '🌿 Nature',
  sports: '⚽ Sports',
  dance: '💃 Dance',
  yoga: '🧘 Yoga',
};

function parseBioContent(rawBio?: string) {
  if (!rawBio) return { cleanBio: '', interests: [] as string[], city: '', intent: '' };
  let cleanBio = rawBio;
  let city = '';
  let intent = '';
  let interests: string[] = [];

  const cityMatch = cleanBio.match(/\[CITY:\s*([^\]]*?)\]/i);
  if (cityMatch && cityMatch[1]) {
    city = cityMatch[1].trim();
  }
  cleanBio = cleanBio.replace(/\[CITY:[^\]]*\]?/gi, '');

  const intentMatch = cleanBio.match(/\[INTENT:\s*([^\]]*?)\]/i);
  if (intentMatch && intentMatch[1]) {
    intent = intentMatch[1].trim();
  }
  cleanBio = cleanBio.replace(/\[INTENT:[^\]]*\]?/gi, '');

  const intMatch = cleanBio.match(/\[INTERESTS:\s*([^\]]*?)\]/i);
  if (intMatch && intMatch[1]) {
    interests = intMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  cleanBio = cleanBio.replace(/\[INTERESTS:[^\]]*\]?/gi, '');

  // Strip any remaining bracketed or unclosed tags
  cleanBio = cleanBio.replace(/\[[A-Za-z0-9_-]+:[^\]]*\]?/gi, '');
  cleanBio = cleanBio.replace(/\[[A-Za-z0-9_-]+\]?/gi, '');

  return { cleanBio: cleanBio.trim(), interests, city, intent };
}

function formatIntent(intentStr?: string) {
  if (!intentStr) return null;
  const lower = intentStr.toLowerCase();
  if (lower.includes('long-term') || lower.includes('relationship')) return `💞 ${intentStr}`;
  if (lower.includes('dating') || lower.includes('seeing where')) return `🥂 ${intentStr}`;
  if (lower.includes('casual') || lower.includes('fun')) return `✨ ${intentStr}`;
  if (lower.includes('friend')) return `🤝 ${intentStr}`;
  return `💫 ${intentStr}`;
}

function calculateAge(birthDateStr?: string) {
  if (!birthDateStr) return null;
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 && age < 120 ? age : null;
}

export default function DiscoverPage() {
  const router = useRouter();
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const lastActiveMap = usePresenceStore((state) => state.lastActiveMap);
  const setPresenceList = usePresenceStore((state) => state.setPresenceList);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('all');

  // Candidate Modal
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  // VIP & Compliments & Quota
  const [isBoosted, setIsBoosted] = useState(false);
  const [swipeQuota, setSwipeQuota] = useState<{ remaining: number; isUnlimited: boolean; totalAllowed: number } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showComplimentModal, setShowComplimentModal] = useState(false);
  const [complimentText, setComplimentText] = useState('');
  const [sendingCompliment, setSendingCompliment] = useState(false);

  // Voice Bio Audio Playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Interactive Two Truths
  const [guessedLieIdx, setGuessedLieIdx] = useState<number | null>(null);

  // Stories
  const [storyGroups, setStoryGroups] = useState<StoryUserGroup[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [isUploadStoryOpen, setIsUploadStoryOpen] = useState(false);

  // Safety Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchQuota = useCallback(async () => {
    try {
      const res = await api.getSwipeQuota();
      setSwipeQuota(res);
    } catch (e) {
      console.warn('Fetch swipe quota error:', e);
    }
  }, []);

  const toggleVoiceBio = (candidateId: string, url?: string) => {
    if (!url) return;
    if (playingVoiceId === candidateId) {
      voiceAudioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (!voiceAudioRef.current) {
        voiceAudioRef.current = new Audio(url);
      } else {
        voiceAudioRef.current.src = url;
      }
      voiceAudioRef.current.play();
      voiceAudioRef.current.onended = () => setPlayingVoiceId(null);
      setPlayingVoiceId(candidateId);
    }
  };

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      let data: any;
      if (discoveryMode === 'top_picks') {
        data = await api.getTopPicks();
      } else if (discoveryMode === 'blind_date') {
        data = await api.getBlindDateQueue();
      } else {
        data = await api.getDiscovery();
      }

      const items = Array.isArray(data) ? data : data?.items || [];
      setCandidates(items);
    } catch (e) {
      console.warn('Discovery fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [discoveryMode]);

  const fetchStories = useCallback(async () => {
    try {
      const data = await api.getStoriesFeed();
      setStoryGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Stories error:', e);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
    fetchStories();
    fetchQuota();
  }, [fetchCandidates, fetchStories, fetchQuota]);



  // Boost Profile
  const handleBoost = async () => {
    try {
      await api.boostProfile(30);
      setIsBoosted(true);
      toast.success('🚀 Profile Spotlight Boosted for 30 minutes!');
    } catch (e: any) {
      toast.error(e.message || 'Could not boost profile');
    }
  };

  // Like Swipe (Once done, not more)
  // Candidate Modal Opener (Locked when swipes are finished)
  const handleOpenCandidate = (candidate: any) => {
    if (swipeQuota && !swipeQuota.isUnlimited && swipeQuota.remaining <= 0) {
      toast.error('🔒 Daily Swipes Finished (0/10). Cards are locked until tomorrow!');
      return;
    }
    setSelectedPhotoIdx(0);
    setGuessedLieIdx(null);
    setSelectedCandidate(candidate);
  };

  // Like / Unlike Swipe (Retains card in deck)
  const handleToggleLike = async (candidate: any) => {
    const isCurrentlyLiked = Boolean(candidate.liked);

    if (!isCurrentlyLiked) {
      if (swipeQuota && !swipeQuota.isUnlimited && swipeQuota.remaining <= 0) {
        toast.error('You have used all 10 free swipes for today! Come back tomorrow.');
        return;
      }

      const nextRemaining = swipeQuota?.isUnlimited
        ? 9999
        : Math.max(0, (swipeQuota?.remaining ?? 10) - 1);

      setSwipeQuota((prev: any) =>
        prev
          ? { ...prev, remaining: nextRemaining }
          : { remaining: nextRemaining, totalAllowed: 10, isUnlimited: false },
      );

      // Keep candidate in deck, mark as liked
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: true } : c)),
      );

      if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
        setSelectedCandidate((prev: any) => (prev ? { ...prev, liked: true } : null));
      }

      try {
        const res = await api.swipe(candidate.userId, 'LIKE');
        if (res?.quota) {
          setSwipeQuota(res.quota);
        } else {
          fetchQuota();
        }
        if (res?.matched) {
          toast.success(`🎉 It's a Match with ${candidate.name}!`);
        } else if (nextRemaining <= 0 && !swipeQuota?.isUnlimited) {
          setSelectedCandidate(null);
          toast.info(`Liked ${candidate.name}! ❤️ You used all 10 daily swipes. Cards are locked until tomorrow.`);
        } else {
          toast.success(`Liked ${candidate.name}! ❤️`);
        }
      } catch (e: any) {
        toast.error(e.message || 'Swipe failed');
        fetchQuota();
      }
    } else {
      // UNLIKE action
      setCandidates((prev) =>
        prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: false } : c)),
      );

      if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
        setSelectedCandidate((prev: any) => (prev ? { ...prev, liked: false } : null));
      }

      try {
        const res = await api.swipe(candidate.userId, 'UNLIKE');
        if (res?.quota) {
          setSwipeQuota(res.quota);
        } else {
          fetchQuota();
        }
        toast.info(`Unliked ${candidate.name}`);
      } catch (e: any) {
        toast.error(e.message || 'Failed to unlike');
        fetchQuota();
      }
    }
  };

  // Pass Candidate
  const handleSwipePass = async (candidate: any) => {
    if (selectedCandidate && selectedCandidate.userId === candidate.userId) {
      setSelectedCandidate(null);
    }
    try {
      const res = await api.swipe(candidate.userId, 'PASS');
      if (res?.quota) {
        setSwipeQuota(res.quota);
      } else {
        fetchQuota();
      }
    } catch (e: any) {
      console.warn('Swipe pass error:', e);
      fetchQuota();
    }
  };

  // Keyboard shortcut for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showComplimentModal) setShowComplimentModal(false);
        else if (showReportModal) setShowReportModal(false);
        else if (selectedCandidate) setSelectedCandidate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCandidate, showComplimentModal, showReportModal]);

  // Send Compliment
  const handleSendCompliment = async () => {
    if (!complimentText.trim() || !selectedCandidate) return;
    setSendingCompliment(true);
    const candidateName = selectedCandidate.name;
    const candidateId = selectedCandidate.userId;

    const nextRemaining = swipeQuota?.isUnlimited ? 9999 : Math.max(0, (swipeQuota?.remaining ?? 10) - 1);
    setSwipeQuota((prev: any) =>
      prev
        ? { ...prev, remaining: nextRemaining }
        : { remaining: nextRemaining, totalAllowed: 10, isUnlimited: false },
    );

    // Keep candidate in deck, mark as liked
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidateId ? { ...c, liked: true } : c)),
    );

    if (nextRemaining <= 0 && !swipeQuota?.isUnlimited) {
      setSelectedCandidate(null);
    } else {
      setSelectedCandidate((prev: any) => (prev ? { ...prev, liked: true } : null));
    }

    try {
      const res = await api.sendCompliment(candidateId, complimentText.trim(), 'profile');
      setShowComplimentModal(false);
      setComplimentText('');
      if (res?.quota) {
        setSwipeQuota(res.quota);
      } else {
        fetchQuota();
      }
      if (nextRemaining <= 0 && !swipeQuota?.isUnlimited) {
        toast.info(`Sent compliment with Super Like to ${candidateName}! 💌 All 10 swipes used. Cards are locked until tomorrow.`);
      } else {
        toast.success(`Sent compliment with Super Like to ${candidateName}! 💌`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not send compliment');
      fetchQuota();
    } finally {
      setSendingCompliment(false);
    }
  };

  // Block User
  const handleBlockUser = async () => {
    if (!selectedCandidate) return;
    if (!confirm(`Block ${selectedCandidate.name}? You will no longer see each other.`)) return;
    try {
      await api.blockUser(selectedCandidate.userId);
      setCandidates((prev) => prev.filter((c) => c.userId !== selectedCandidate.userId));
      setSelectedCandidate(null);
      toast.success(`${selectedCandidate.name} has been blocked.`);
    } catch (e: any) {
      toast.error(e.message || 'Could not block user');
    }
  };

  // Submit Report
  const handleReportSubmit = async () => {
    if (!selectedCandidate) return;
    setSubmittingReport(true);
    try {
      const reportedUserId = selectedCandidate.userId;
      const reportedName = selectedCandidate.name;
      await api.reportUser(reportedUserId, reportReason, reportDetails);
      setShowReportModal(false);
      setSelectedCandidate(null);
      setCandidates((prev) => prev.filter((c) => c.userId !== reportedUserId));
      setReportDetails('');
      toast.success(`Report for ${reportedName} submitted to moderation. Thank you.`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to report user');
    } finally {
      setSubmittingReport(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const activity = formatUserActivity(c.userId, c.updatedAt, onlineUserIds, lastActiveMap);
      if (statusFilter === 'online' && !activity.isOnline) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.name?.toLowerCase().includes(q) || c.bio?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [candidates, statusFilter, searchQuery, onlineUserIds, lastActiveMap]);

  return (
    <div className="w-full px-4 sm:px-8 xl:px-12 py-6 space-y-6 max-w-none">
      {/* Stories Bar */}
      <StoriesBar
        groups={storyGroups}
        onOpenViewer={(idx) => setActiveStoryIdx(idx)}
        onOpenUpload={() => setIsUploadStoryOpen(true)}
      />

      {/* Search, Status Filters & VIP Actions */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search candidates by name, interests or vibe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/70 transition-colors shadow-inner"
          />
        </div>

        {/* Filters and VIP Actions Row */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Status Filter (All / Online) */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'all'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${statusFilter === 'online'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-neutral-400 hover:text-white'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
            </button>
          </div>

          {/* Daily Swipe Quota Badge */}
          {swipeQuota && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all ${
                swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-200'
              }`}
            >
              <IconFlame
                size={14}
                className={
                  swipeQuota.remaining <= 3 && !swipeQuota.isUnlimited
                    ? 'text-rose-400'
                    : 'text-rose-500'
                }
              />
              {swipeQuota.isUnlimited ? (
                <span className="text-amber-400 font-extrabold">Unlimited VIP ✨</span>
              ) : (
                <span>
                  <strong className="text-white font-black">{swipeQuota.remaining}</strong> /{' '}
                  {swipeQuota.totalAllowed} Swipes Left
                </span>
              )}
            </div>
          )}



          {/* Boost Button */}
          <button
            onClick={handleBoost}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isBoosted
              ? 'bg-purple-600 text-white shadow-purple-500/30 animate-pulse'
              : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30'
              }`}
            title="Boost Profile Spotlight"
          >
            <IconBolt size={15} />
            <span>{isBoosted ? 'Boosted 🔥' : 'Boost'}</span>
          </button>
        </div>
      </div>

      {/* Candidates Deck */}
      {loading ? (
        <DiscoverSkeleton />
      ) : filteredCandidates.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-3xl">✨</p>
          <h3 className="text-lg font-bold text-white">No Profiles Found</h3>
          <p className="text-xs text-neutral-400">Try switching filters or check back shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
          {filteredCandidates.map((c) => {
            const photoUrl =
              c.photos?.[0]?.url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600';
            const isBlind = discoveryMode === 'blind_date';

            return (
              <div
                key={c.userId}
                onClick={() => handleOpenCandidate(c)}
                className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border cursor-pointer transition-all hover:scale-[1.02] shadow-lg ${c.isBoosted
                  ? 'border-amber-500/60 shadow-amber-500/20'
                  : 'border-neutral-800 hover:border-rose-500/40'
                  }`}
              >
                <img
                  src={photoUrl}
                  alt={c.name}
                  className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${isBlind ? 'blur-xl scale-110 opacity-75' : ''
                    }`}
                />

                {/* Top Spotlight Tag / Like Float */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  {c.isBoosted ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-neutral-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <IconBolt size={12} /> Spotlight
                    </span>
                  ) : (
                    <span />
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLike(c);
                    }}
                    className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:text-rose-500 transition-colors"
                  >
                    <IconHeart
                      size={16}
                      className={c.liked ? 'text-rose-500 fill-rose-500' : 'text-white'}
                    />
                  </button>
                </div>

                {/* Bottom Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent flex flex-col justify-end p-3 space-y-1">
                  <div className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>{isBlind ? 'Mystery Match' : c.name}</span>
                    {(c.isVerified || c.verified) && !isBlind && (
                      <span className="text-blue-400 text-xs" title="Verified Blue Badge">
                        🛡️
                      </span>
                    )}
                  </div>

                  {c.topPickReason ? (
                    <span className="text-[10px] text-amber-400 font-bold">{c.topPickReason}</span>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <IconMapPin size={12} className="text-rose-400" />
                      <span>{c.distance_km ? `${c.distance_km.toFixed(1)} km away` : 'Nearby'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl overflow-hidden animate-in fade-in duration-200"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full sm:h-[92vh] sm:max-h-[850px] sm:max-w-md md:max-w-lg flex flex-col bg-neutral-950 sm:bg-neutral-900 sm:rounded-3xl sm:border sm:border-neutral-800 shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Photo Carousel Banner */}
            <div className="relative h-72 sm:h-80 w-full shrink-0 bg-neutral-950 select-none overflow-hidden">
              <img
                src={
                  selectedCandidate.photos?.[selectedPhotoIdx]?.url ||
                  selectedCandidate.photos?.[0]?.url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600'
                }
                alt={selectedCandidate.name}
                className="w-full h-full object-cover transition-all duration-300"
              />

              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/60 pointer-events-none" />

              {/* Top Floating Badges */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  {selectedCandidate.isBoosted && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-500 text-neutral-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-amber-500/30">
                      <IconBolt size={12} /> Spotlight
                    </span>
                  )}
                  {(() => {
                    const activity = formatUserActivity(
                      selectedCandidate.userId,
                      selectedCandidate.updatedAt,
                      onlineUserIds,
                      lastActiveMap
                    );
                    return activity.isOnline ? (
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-emerald-400 font-bold text-[11px] flex items-center gap-1.5 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Online Now
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Left / Right Photo Arrows */}
              {selectedCandidate.photos?.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIdx((prev) =>
                        prev === 0 ? selectedCandidate.photos.length - 1 : prev - 1
                      );
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:scale-105 z-10"
                    title="Previous Photo"
                  >
                    <IconChevronLeft size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIdx((prev) =>
                        prev === selectedCandidate.photos.length - 1 ? 0 : prev + 1
                      );
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:scale-105 z-10"
                    title="Next Photo"
                  >
                    <IconChevronRight size={18} />
                  </button>
                </>
              )}

              {/* Photo Indicators & Counter */}
              {selectedCandidate.photos?.length > 1 && (
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-1.5">
                    {selectedCandidate.photos.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPhotoIdx(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          selectedPhotoIdx === idx ? 'w-6 bg-rose-500' : 'w-1.5 bg-white/50 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-bold border border-white/10">
                    {selectedPhotoIdx + 1} / {selectedCandidate.photos.length}
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable Details Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 text-left">
              {(() => {
                const parsed = parseBioContent(selectedCandidate.bio);
                const age = calculateAge(selectedCandidate.birthDate);
                const location =
                  parsed.city ||
                  (selectedCandidate.distance_km
                    ? `${selectedCandidate.distance_km.toFixed(1)} km away`
                    : 'Nearby');
                const intentLabel = formatIntent(
                  parsed.intent || selectedCandidate.relationshipIntent
                );

                return (
                  <>
                    {/* Profile Header Block */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-2xl font-black text-white tracking-tight">
                            {selectedCandidate.name}
                            {age && (
                              <span className="font-semibold text-neutral-300 ml-1.5">, {age}</span>
                            )}
                          </h2>
                          {(selectedCandidate.isVerified || selectedCandidate.verified) && (
                            <span className="inline-flex items-center text-blue-400" title="Verified Profile">
                              <IconShieldCheck size={20} className="fill-blue-500/20" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                          <IconMapPin size={13} className="text-rose-400 shrink-0" />
                          <span>{location}</span>
                        </p>
                      </div>

                      {/* Chemistry Match Score */}
                      <div className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm">
                        <IconSparkles size={14} className="text-purple-400" />
                        <span>94% Chemistry</span>
                      </div>
                    </div>

                    {/* Relationship Intent Chip */}
                    {intentLabel && (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold">
                        <span>{intentLabel}</span>
                      </div>
                    )}

                    {/* Bio / About */}
                    <div className="space-y-1.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">About</h4>
                      <div className="p-3.5 rounded-2xl bg-neutral-800/60 border border-neutral-800/80 text-sm text-neutral-200 leading-relaxed">
                        {parsed.cleanBio || 'Exploring good coffee, lively conversations, and new experiences.'}
                      </div>
                    </div>

                    {/* Voice Bio Player (if candidate has recorded one) */}
                    {selectedCandidate.voiceBioUrl && (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-neutral-900 to-neutral-950 border border-rose-900/40 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleVoiceBio(selectedCandidate.userId, selectedCandidate.voiceBioUrl)}
                            className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                          >
                            {playingVoiceId === selectedCandidate.userId ? (
                              <IconPlayerPause size={20} />
                            ) : (
                              <IconPlayerPlay size={20} className="ml-0.5" />
                            )}
                          </button>
                          <div>
                            <span className="text-xs font-bold text-white block">Voice Introduction</span>
                            <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                              <IconVolume size={12} /> {selectedCandidate.name}&apos;s audio intro
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 pr-2">
                          {[30, 60, 90, 50, 80, 45, 100, 70, 40, 85].map((h, i) => (
                            <span
                              key={i}
                              className={`w-1 rounded-full bg-rose-500 transition-all ${
                                playingVoiceId === selectedCandidate.userId ? 'animate-pulse' : 'opacity-50'
                              }`}
                              style={{ height: `${h * 0.22}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}


                    {/* Interests & Passions */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Interests & Passions</h4>
                      <div className="flex flex-wrap gap-2">
                        {(parsed.interests.length > 0
                          ? parsed.interests
                          : selectedCandidate.interests || ['coffee', 'travel', 'music']
                        ).map((tag: string) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 rounded-xl bg-neutral-800/90 text-neutral-200 text-xs font-medium border border-neutral-700/60 shadow-sm"
                          >
                            {INTEREST_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    </div>



                    {/* Two Truths & A Lie Interactive Game */}
                    {selectedCandidate.twoTruths && (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🎭</span> Two Truths & A Lie — Guess the lie!
                        </h4>
                        <div className="space-y-2">
                          {selectedCandidate.twoTruths.statements.map((stmt: string, idx: number) => {
                            const isLie = idx === selectedCandidate.twoTruths?.lieIndex;
                            const hasGuessed = guessedLieIdx !== null;
                            return (
                              <button
                                key={idx}
                                onClick={() => setGuessedLieIdx(idx)}
                                className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                                  hasGuessed && isLie
                                    ? 'bg-red-500/20 border-red-500 text-red-300'
                                    : hasGuessed && guessedLieIdx === idx && !isLie
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                    : 'bg-neutral-800/80 border-neutral-700/60 text-white hover:bg-neutral-800'
                                }`}
                              >
                                <span>{stmt}</span>
                                {hasGuessed && (
                                  <span className="font-bold text-[10px]">
                                    {isLie ? '❌ That is the Lie!' : '✅ Truth!'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </>
                );
              })()}
            </div>

            {/* Pinned Bottom Action Bar (Production Tinder/Bumble Dock) */}
            <div className="p-3.5 sm:p-4 bg-neutral-950/95 sm:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-800/80 shrink-0 flex items-center justify-between gap-2.5 z-20">
              {/* Pass Button */}
              <button
                onClick={() => {
                  handleSwipePass(selectedCandidate);
                }}
                className="w-12 h-12 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-500/50 flex items-center justify-center transition-all active:scale-95 shadow-md group shrink-0"
                title="Pass Profile"
              >
                <IconX size={22} className="group-hover:scale-110 transition-transform stroke-[2.5]" />
              </button>

              {/* Compliment / Super Like Shortcut */}
              <button
                onClick={() => setShowComplimentModal(true)}
                className="w-12 h-12 rounded-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 flex items-center justify-center transition-all active:scale-95 shadow-md group shrink-0"
                title="Send Compliment (Super Like)"
              >
                <IconStar size={20} className="fill-purple-400 text-purple-400 group-hover:scale-110 transition-transform" />
              </button>

              {/* Match & Connect / Liked Button */}
              <button
                onClick={() => handleToggleLike(selectedCandidate)}
                className={`flex-1 h-12 px-4 rounded-full font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] cursor-pointer ${
                  selectedCandidate.liked
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                    : 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-600 text-white shadow-rose-500/30'
                }`}
              >
                <IconHeart size={20} className={selectedCandidate.liked ? 'fill-white stroke-[2]' : 'fill-white/20 stroke-[2]'} />
                <span>{selectedCandidate.liked ? 'Liked ❤️' : 'Like'}</span>
              </button>

              {/* Chat Button */}
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  router.push('/chat');
                }}
                className="w-12 h-12 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 hover:border-neutral-700 flex items-center justify-center transition-all active:scale-95 shadow-md shrink-0"
                title="Open Chat"
              >
                <IconMessageCircle2 size={20} className="stroke-[2]" />
              </button>

              {/* Safety: Report */}
              <button
                onClick={() => setShowReportModal(true)}
                className="w-10 h-10 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 border border-neutral-800 flex items-center justify-center transition-all shrink-0"
                title="Report Profile"
              >
                <IconFlag size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliment Modal */}
      {showComplimentModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                <span>💌</span> Send a Compliment
              </h3>
              <button
                onClick={() => setShowComplimentModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Leave a note on {selectedCandidate?.name}&apos;s profile to send with a Super Like:
            </p>
            <textarea
              value={complimentText}
              onChange={(e) => setComplimentText(e.target.value)}
              placeholder="e.g. Loved your concert photo! Who was playing?"
              maxLength={140}
              className="w-full h-24 p-3 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 resize-none"
            />
            <button
              onClick={handleSendCompliment}
              disabled={sendingCompliment}
              className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/25"
            >
              {sendingCompliment ? 'Sending...' : 'Send with Super Like ⭐'}
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Report {selectedCandidate?.name}</h3>
              <button onClick={() => setShowReportModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2">
              {[
                { id: 'harassment', label: 'Harassment or Inappropriate behavior' },
                { id: 'fake_profile', label: 'Fake Profile / Catfish' },
                { id: 'inappropriate_photos', label: 'Inappropriate Photos' },
                { id: 'spam', label: 'Spam or Promotional' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReportReason(r.id)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${reportReason === r.id
                    ? 'bg-red-500/20 border-red-500 text-white'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Additional details (optional)..."
              className="w-full h-20 p-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs text-white placeholder-neutral-500 resize-none"
            />
            <button
              onClick={handleReportSubmit}
              disabled={submittingReport}
              className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors"
            >
              {submittingReport ? 'Submitting...' : 'Submit Report to Moderation'}
            </button>
          </div>
        </div>
      )}

      {/* Global Notification Modal */}
      <NotificationModal isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Stories Viewer & Upload Modals */}
      {activeStoryIdx !== null && storyGroups[activeStoryIdx] && (
        <StoryViewerModal
          groups={storyGroups}
          initialUserIndex={activeStoryIdx}
          onClose={() => setActiveStoryIdx(null)}
          onStoryDeleted={() => fetchStories()}
        />
      )}
      {isUploadStoryOpen && (
        <StoryUploadModal
          onClose={() => setIsUploadStoryOpen(false)}
          onStoryUploaded={() => fetchStories()}
        />
      )}
    </div>
  );
}
