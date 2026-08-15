'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconMapPin, IconUser, IconSparkles, IconHeart, IconHeartFilled, IconMessages } from '@tabler/icons-react';
import { toast } from 'sonner';

type Candidate = {
  userId: string;
  name: string;
  bio?: string;
  distance_km: number;
  liked?: boolean;
  photos?: { id: string; url: string }[];
};

export default function DiscoverPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, []);

  function fetchCandidates() {
    setLoading(true);
    api
      .getDiscovery()
      .then((data) => {
        setCandidates(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  async function handleToggleLike(candidate: Candidate) {
    const isCurrentlyLiked = !!candidate.liked;
    const nextLikedState = !isCurrentlyLiked;

    // Optimistically update UI
    setCandidates((prev) =>
      prev.map((c) => (c.userId === candidate.userId ? { ...c, liked: nextLikedState } : c))
    );

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
      toast.error('Failed to update match status. Please try again.');
    }
  }

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-8 min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Discover People</h1>
          <p className="text-sm text-neutral-400 mt-1">Hover over any photo and click the heart icon to match</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-ember border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm font-medium">Loading registered member profiles...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center p-8 bg-neutral-900/60 border border-neutral-800 rounded-3xl max-w-sm">
            <IconSparkles size={40} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">No Profiles Found</h3>
            <p className="text-neutral-400 text-xs mt-1">
              No profiles available right now. Check back later or refresh feed.
            </p>
            <button
              onClick={fetchCandidates}
              className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors"
            >
              Refresh Feed
            </button>
          </div>
        </div>
      ) : (
        /* 3-Column Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((candidate) => (
            <div
              key={candidate.userId}
              className="group relative bg-neutral-900 border border-neutral-800/80 hover:border-rose-500/40 rounded-3xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col"
            >
              {/* Photo & Cover */}
              <div className="aspect-[3/4] relative bg-neutral-800 overflow-hidden">
                {candidate.photos?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.photos[0].url}
                    alt={candidate.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-900 text-neutral-600">
                    <IconUser size={64} stroke={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-90 pointer-events-none" />

                {/* Match Heart Icon on Top-Right Corner (no circular background, heart fills with color) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLike(candidate);
                  }}
                  title={candidate.liked ? 'Matched! Click to unmatch' : 'Click heart to match'}
                  aria-label={`Match ${candidate.name}`}
                  className={`absolute top-3.5 right-3.5 z-20 transition-all duration-300 transform active:scale-90 cursor-pointer drop-shadow-md ${candidate.liked
                    ? 'text-rose-500 opacity-100 scale-100 drop-shadow-[0_2px_10px_rgba(244,63,94,0.7)]'
                    : 'text-white/80 hover:text-rose-500 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 hover:drop-shadow-[0_2px_10px_rgba(244,63,94,0.5)]'
                    }`}
                >
                  {candidate.liked ? (
                    <IconHeartFilled size={28} className="animate-pulse" />
                  ) : (
                    <IconHeart size={28} className="stroke-[2.2] hover:fill-rose-500 transition-colors" />
                  )}
                </button>

                {/* Candidate Information Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white pointer-events-none">
                  <h3 className="text-xl font-bold tracking-wide flex items-center gap-2">
                    <span>{candidate.name}</span>
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-neutral-300 mt-1">
                    <IconMapPin size={14} className="text-ember" />
                    <span>
                      {candidate.distance_km != null && candidate.distance_km > 0
                        ? `${candidate.distance_km.toFixed(1)} km away`
                        : 'Nearby'}
                    </span>
                  </div>
                  {candidate.bio && (
                    <p className="text-xs text-neutral-300/90 mt-2 line-clamp-2 leading-relaxed">
                      {candidate.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

