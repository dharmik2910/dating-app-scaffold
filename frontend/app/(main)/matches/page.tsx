'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  IconHeart,
  IconMessageCircle,
  IconSparkles,
  IconStar,
  IconShieldCheck,
  IconMapPin,
  IconList,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import MatchesSkeleton from '@/components/MatchesSkeleton';

export default function MatchesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'matches' | 'likes_you'>('matches');
  const [matches, setMatches] = useState<any[]>([]);
  const [likesYou, setLikesYou] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [remoteMatches, admirers] = await Promise.all([
        api.getMatches(undefined, 50, 'matches'),
        api.getWhoLikedMe().catch(() => []),
      ]);

      const items = Array.isArray(remoteMatches) ? remoteMatches : remoteMatches?.items || [];
      setMatches(items);

      if (Array.isArray(admirers)) {
        setLikesYou(admirers);
      }
    } catch (e) {
      console.warn('Fetch matches & likes error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantMatch = async (admirer: any) => {
    try {
      await api.swipe(admirer.user.id, 'LIKE');
      toast.success(`Matched with ${admirer.user.name}! 🎉`);
      setLikesYou((prev) => prev.filter((l) => l.swiperId !== admirer.swiperId));
      fetchData();
      router.push(`/chat`);
    } catch (e: any) {
      toast.error(e.message || 'Could not match with admirer');
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.otherUser?.name?.toLowerCase().includes(q) || m.otherUser?.bio?.toLowerCase().includes(q);
  });

  const filteredLikesYou = likesYou.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return l.user?.name?.toLowerCase().includes(q) || l.comment?.toLowerCase().includes(q);
  });

  return (
    <div className="w-full px-4 sm:px-8 xl:px-12 py-8 space-y-6 max-w-none">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Matches & Admirers
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            People you have matched with or who have liked your profile.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'matches'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <IconHeart size={16} />
            Mutual Matches ({matches.length})
          </button>
          <button
            onClick={() => setActiveTab('likes_you')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'likes_you'
                ? 'bg-amber-500 text-neutral-950 font-extrabold shadow-lg shadow-amber-500/25'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <IconStar size={16} />
            Likes You ({likesYou.length})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Filter by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors shadow-inner"
        />
      </div>

      {loading ? (
        <MatchesSkeleton />
      ) : activeTab === 'matches' ? (
        /* Mutual Matches Grid */
        filteredMatches.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center text-3xl">
              💔
            </div>
            <h3 className="text-lg font-bold text-white">No Mutual Matches Found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Keep exploring the discovery deck! When someone likes you back, they will appear here.
            </p>
            <Link
              href="/discover"
              className="inline-block px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white transition-all shadow-lg shadow-rose-500/20"
            >
              Explore Profiles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
            {filteredMatches.map((m) => {
              const other = m.otherUser;
              const photoUrl =
                other?.photos?.[0]?.url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600';

              return (
                <div
                  key={m.id}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-md hover:border-rose-500/50 transition-all"
                >
                  <img src={photoUrl} alt={other?.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white text-sm flex items-center gap-1">
                        {other?.name || 'Match'}
                        {other?.isVerified && (
                          <span className="text-blue-400 text-xs" title="Verified">
                            🛡️
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/chat/${m.id}`}
                      className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white transition-colors"
                    >
                      <IconMessageCircle size={14} />
                      <span>Chat</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (

        /* Likes You (VIP Gold Grid) */
        <div className="space-y-6">
          {/* Banner */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
              ⭐
            </div>
            <div>
              <h3 className="font-bold text-amber-400 text-sm">Gold Spotlight Admirers</h3>
              <p className="text-xs text-neutral-300">
                These people have already swiped right on your profile. Click &ldquo;Match &amp; Chat&rdquo; to connect instantly!
              </p>
            </div>
          </div>

          {likesYou.length === 0 ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center text-3xl">
                ✨
              </div>
              <h3 className="text-lg font-bold text-white">No New Likes Yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Boost your profile or add rich prompts to stand out and attract new admirers!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
              {likesYou.map((admirer) => {
                const photoUrl =
                  admirer.user?.photos?.[0]?.url ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600';

                return (
                  <div
                    key={admirer.swipeId}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border-2 border-amber-500/40 shadow-xl"
                  >
                    <img src={photoUrl} alt={admirer.user?.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-3.5 space-y-1.5">
                      <div className="font-bold text-white text-sm flex items-center gap-1">
                        {admirer.user?.name || 'Admirer'}
                        {admirer.user?.isVerified && <span className="text-blue-400 text-xs">🛡️</span>}
                      </div>

                      {admirer.comment ? (
                        <div className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-[11px] text-purple-200 italic line-clamp-2">
                          &ldquo;{admirer.comment}&rdquo;
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 line-clamp-1">
                          {admirer.user?.bio || 'Liked your profile'}
                        </p>
                      )}

                      <button
                        onClick={() => handleInstantMatch(admirer)}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-extrabold text-xs transition-all shadow-md shadow-amber-500/30 flex items-center justify-center gap-1.5"
                      >
                        <IconHeart size={14} className="fill-neutral-950" />
                        Match & Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
