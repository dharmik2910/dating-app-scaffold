'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  IconUser,
  IconLogout,
  IconPlus,
  IconPhoto,
  IconTrash,
  IconSparkles,
  IconCheck,
  IconStar,
  IconDeviceFloppy,
  IconShieldCheck,
  IconPlane,
  IconEyeOff,
  IconBan,
  IconCamera,
  IconX,
  IconFlame,
  IconMicrophone,
  IconPlayerPlay,
  IconPlayerPause,
  IconWand,
  IconVolume,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';
import ProfileSkeleton from '@/components/ProfileSkeleton';

type PhotoItem = { id: string; url: string; order: number };

type UserProfile = {
  name: string;
  gender: string;
  preference: string;
  bio?: string;
  photos?: PhotoItem[];
  interests?: string[];
  isVerified?: boolean;
  verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  isIncognito?: boolean;
  passportCity?: string | null;
  voiceBioUrl?: string | null;
  twoTruths?: {
    statement1: string;
    statement2: string;
    statement3: string;
    lieIndex: number;
  };
};

const POPULAR_INTERESTS = [
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'fitness', label: '🏋️‍♂️ Fitness' },
  { id: 'music', label: '🎧 Music' },
  { id: 'foodie', label: '🍕 Foodie' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'art', label: '🎨 Art' },
  { id: 'photography', label: '📸 Photography' },
  { id: 'reading', label: '📚 Reading' },
  { id: 'pets', label: '🐶 Pets' },
  { id: 'movies', label: '🎬 Movies' },
  { id: 'tech', label: '💻 Tech' },
  { id: 'hiking', label: '🧗‍♂️ Outdoor' },
  { id: 'wine', label: '🍷 Wine & Dine' },
];


const PASSPORT_CITIES = [
  { name: '📍 Current Location', city: '', lat: null, lng: null },
  { name: '🗽 New York, USA', city: 'New York, USA', lat: 40.7128, lng: -74.006 },
  { name: '🗼 Paris, France', city: 'Paris, France', lat: 48.8566, lng: 2.3522 },
  { name: '⛩️ Tokyo, Japan', city: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: '🎡 London, UK', city: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: '🏝️ Bali, Indonesia', city: 'Bali, Indonesia', lat: -8.4095, lng: 115.1889 },
  { name: '🦘 Sydney, Australia', city: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
];

export default function ProfilePage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  // Verification Modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);

  // AI Bio Assistant Modal
  const [showAiBioModal, setShowAiBioModal] = useState(false);
  const [aiBioVibe, setAiBioVibe] = useState<'funny' | 'romantic' | 'adventurous' | 'creative'>('creative');
  const [aiBioSuggestions, setAiBioSuggestions] = useState<any[]>([]);
  const [generatingAiBio, setGeneratingAiBio] = useState(false);

  // Voice Bio
  const [voiceBioUrl, setVoiceBioUrl] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<any>(null);


  // Two Truths & A Lie
  const [truth1, setTruth1] = useState('');
  const [truth2, setTruth2] = useState('');
  const [truth3, setTruth3] = useState('');
  const [lieIndex, setLieIndex] = useState(2);

  // Incognito & Passport
  const [isIncognito, setIsIncognito] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');

  const [initialDetails, setInitialDetails] = useState<{
    name: string;
    gender: string;
    preference: string;
    bio: string;
    interests: string[];
  } | null>(null);


  useEffect(() => {
    fetchProfile();
    fetchBlocked();
  }, []);

  async function fetchProfile() {
    try {
      const res = await api.getMe();
      const userPhotos = res.photos || res.profile?.photos || [];
      const userBio = res.profile?.bio || '';
      const rawInterests =
        Array.isArray(res.profile?.interests) && res.profile.interests.length > 0
          ? res.profile.interests
          : parseInterestsFromBio(userBio).interests;
      const parsedInterests = parseInterestsFromBio(userBio);

      const fetchedProfile = {
        ...(res.profile || {}),
        photos: userPhotos,
        preference: res.profile?.interestedIn?.[0] || 'FEMALE',
      };

      setProfile(fetchedProfile);
      setSelectedInterests(rawInterests);
      setIsIncognito(Boolean(fetchedProfile.incognitoMode ?? fetchedProfile.isIncognito));
      setSelectedCity(fetchedProfile.passportCity || '');
      setVoiceBioUrl(res.profile?.voiceBioUrl || null);

      if (fetchedProfile.twoTruths) {
        const tt = fetchedProfile.twoTruths;
        if (Array.isArray(tt.statements) && tt.statements.length >= 3) {
          setTruth1(tt.statements[0] || '');
          setTruth2(tt.statements[1] || '');
          setTruth3(tt.statements[2] || '');
        } else {
          setTruth1(tt.statement1 || '');
          setTruth2(tt.statement2 || '');
          setTruth3(tt.statement3 || '');
        }
        setLieIndex(typeof tt.lieIndex === 'number' ? tt.lieIndex : 2);
      }

      setInitialDetails({
        name: fetchedProfile.name || '',
        gender: fetchedProfile.gender || 'MALE',
        preference: fetchedProfile.preference || 'FEMALE',
        bio: parsedInterests.cleanBio,
        interests: rawInterests,
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile data');
      setLoading(false);
    }
  }

  async function handleGenerateAiBio(vibe: 'funny' | 'romantic' | 'adventurous' | 'creative' = aiBioVibe) {
    setGeneratingAiBio(true);
    try {
      const res = await api.generateAiBio(vibe);
      setAiBioSuggestions(res.suggestions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate AI bios');
    } finally {
      setGeneratingAiBio(false);
    }
  }

  function handleApplyAiBio(suggestedBio: string) {
    const fullBio = formatBioWithInterests(suggestedBio, selectedInterests);
    setProfile((prev) => (prev ? { ...prev, bio: fullBio } : null));
    setShowAiBioModal(false);
    toast.success('Applied AI bio to profile! Click "Save Basic Profile" to commit changes.');
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          setVoiceBioUrl(base64data);
          try {
            await api.setVoiceBio(base64data);
            toast.success('Voice bio saved to your dating card! 🎙️');
          } catch (e: any) {
            toast.error(e.message || 'Failed to save voice bio');
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) {
            stopVoiceRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error('Microphone access denied or unavailable');
    }
  }

  function stopVoiceRecording() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
  }

  function playVoiceBio() {
    if (!voiceBioUrl) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(voiceBioUrl);
      audioPlayerRef.current.onended = () => setIsPlayingVoice(false);
    } else {
      audioPlayerRef.current.src = voiceBioUrl;
    }
    audioPlayerRef.current.play();
    setIsPlayingVoice(true);
  }

  function pauseVoiceBio() {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingVoice(false);
    }
  }

  async function handleDeleteVoiceBio() {
    try {
      await api.setVoiceBio(null);
      setVoiceBioUrl(null);
      toast.success('Voice bio removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove voice bio');
    }
  }


  async function fetchBlocked() {
    try {
      const data = await api.getBlockedUsers();
      setBlockedUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    }
  }

  function parseInterestsFromBio(bio: string): { cleanBio: string; interests: string[] } {
    const tagMatch = bio.match(/\[INTERESTS:(.*?)\]/);
    if (tagMatch && tagMatch[1]) {
      const interests = tagMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
      const cleanBio = bio.replace(/\[INTERESTS:.*?\]/, '').trim();
      return { cleanBio, interests };
    }
    return { cleanBio: bio, interests: [] };
  }

  function formatBioWithInterests(cleanBio: string, interests: string[]): string {
    if (interests.length === 0) return cleanBio;
    return `${cleanBio.trim()}\n\n[INTERESTS:${interests.join(',')}]`;
  }

  function getCleanBioDisplay(bio?: string): string {
    if (!bio) return '';
    return bio.replace(/\[INTERESTS:.*?\]/, '').trim();
  }

  const calculateCompleteness = () => {
    if (!profile) return 0;
    let score = 0;
    const cleanBio = getCleanBioDisplay(profile.bio);

    if (profile.name?.trim()) score += 20;
    if (profile.photos && profile.photos.length >= 1) score += 20;
    if (profile.photos && profile.photos.length >= 3) score += 15;
    if (cleanBio.length > 10) score += 15;
    if (selectedInterests.length >= 3) score += 15;
    if (profile.isVerified) score += 15;

    return Math.min(100, score);
  };

  const completenessScore = calculateCompleteness();

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((i) => i !== interestId)
        : prev.length < 6
          ? [...prev, interestId]
          : prev
    );
  };

  const cleanBioText = getCleanBioDisplay(profile?.bio);

  const hasChanges = Boolean(
    initialDetails &&
    (profile?.name !== initialDetails.name ||
      (profile?.gender || 'MALE') !== initialDetails.gender ||
      (profile?.preference || 'FEMALE') !== initialDetails.preference ||
      cleanBioText !== initialDetails.bio ||
      JSON.stringify([...selectedInterests].sort()) !==
      JSON.stringify([...initialDetails.interests].sort()))
  );

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
      const interestedInArray =
        profile.preference === 'EVERYONE'
          ? ['MALE', 'FEMALE', 'NONBINARY', 'OTHER']
          : [profile.preference || 'FEMALE'];

      const cleanBio = getCleanBioDisplay(profile.bio);
      const fullBio = formatBioWithInterests(cleanBio, selectedInterests);

      await api.updateProfile({
        name: profile.name,
        dob: (profile as any).dob || '2000-01-01T00:00:00.000Z',
        gender: profile.gender || 'MALE',
        interestedIn: interestedInArray,
        bio: fullBio,
        interests: selectedInterests,
      });

      setProfile((prev) => (prev ? { ...prev, bio: fullBio } : null));
      setInitialDetails({
        name: profile.name || '',
        gender: profile.gender || 'MALE',
        preference: profile.preference || 'FEMALE',
        bio: cleanBio,
        interests: selectedInterests,
      });
      toast.success('Basic Profile saved successfully! ✨');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  // Save Extended Preferences (Incognito, Passport, Two Truths)
  async function handleSaveExtended() {
    setSaving(true);
    try {
      const selectedCityObj = PASSPORT_CITIES.find((c) => c.city === selectedCity);

      await api.updateExtendedProfile({
        isIncognito,
        incognitoMode: isIncognito,
        passportActive: Boolean(selectedCity),
        passportCity: selectedCity || null,
        passportLat: selectedCityObj?.lat || null,
        passportLng: selectedCityObj?.lng || null,
        twoTruths: truth1.trim() && truth2.trim() && truth3.trim() ? {
          statement1: truth1,
          statement2: truth2,
          statement3: truth3,
          statements: [truth1, truth2, truth3],
          lieIndex,
        } : undefined,
      });

      toast.success('Features & Privacy preferences saved! ✨');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Verification
  async function handleVerificationSubmit() {
    setSubmittingVerify(true);
    try {
      const selfieUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
      await api.submitVerification(selfieUrl);
      toast.success('Selfie submitted for Blue Badge verification! 🛡️');
      setShowVerifyModal(false);
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Verification submission failed');
    } finally {
      setSubmittingVerify(false);
    }
  }


  // Unblock
  async function handleUnblockUser(userId: string) {
    try {
      await api.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== userId && b.id !== userId));
      toast.success('User unblocked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to unblock user');
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if ((profile?.photos?.length || 0) >= 6) {
      toast.error('You can upload up to 6 photos only. Please delete one first.');
      return;
    }
    setUploadingPhoto(true);
    const toastId = toast.loading('Uploading your photo...');
    try {
      const order = profile?.photos?.length || 0;
      await api.uploadPhoto(file, order);
      await fetchProfile();
      toast.success('Photo uploaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed', { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setDeletingPhotoId(photoId);
    const toastId = toast.loading('Deleting photo...');
    try {
      await api.deletePhoto(photoId);
      setProfile((prev) =>
        prev ? { ...prev, photos: prev.photos?.filter((p) => p.id !== photoId) } : null
      );
      toast.success('Photo removed', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete photo', { id: toastId });
    } finally {
      setDeletingPhotoId(null);
    }
  }

  function handleLogout() {
    logout();
    toast.success('Signed out successfully');
    router.replace('/login');
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  const photos = profile?.photos || [];

  return (
    <main className="w-full px-4 sm:px-8 py-8 min-h-[calc(100vh-4rem)] flex flex-col space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-row items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <IconUser size={30} className="text-rose-500" />
              <span>Profile Studio</span>
            </h1>
            {profile?.isVerified ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold flex items-center gap-1">
                ✓ Photo Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowVerifyModal(true)}
                className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <IconShieldCheck size={14} />
                <span>Get Verified Badge</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Manage your dating card, bio, game setups, and safety privacy
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {((user?.phone && user.phone.replace(/\D/g, '').includes('9924662647')) || process.env.NODE_ENV === 'development') && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors shadow-sm cursor-pointer"
            >
              <IconShieldCheck size={16} />
              <span>Admin Panel</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-xl hover:bg-rose-900/60 transition-colors shadow-sm cursor-pointer"
          >
            <IconLogout size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Studio 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Details & Two Truths */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Main Profile Details Form */}
          <form
            onSubmit={handleSave}
            className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <IconUser size={22} className="text-rose-500" />
                <span>Basic Profile</span>
              </h2>
              <span className="text-xs text-neutral-400 font-medium">Personal Information</span>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Name
              </label>
              <input
                type="text"
                value={profile?.name || ''}
                onChange={(e) => setProfile((prev) => (prev ? { ...prev, name: e.target.value } : null))}
                placeholder="Your name"
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/60 transition-colors text-sm font-medium shadow-inner"
              />
            </div>

            {/* Gender & Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Gender
                </label>
                <select
                  value={profile?.gender || 'MALE'}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, gender: e.target.value } : null))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/60 transition-colors text-sm font-medium cursor-pointer shadow-inner"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="NONBINARY">Non-Binary</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Interested In
                </label>
                <select
                  value={profile?.preference || 'FEMALE'}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, preference: e.target.value } : null))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/60 transition-colors text-sm font-medium cursor-pointer shadow-inner"
                >
                  <option value="MALE">Men</option>
                  <option value="FEMALE">Women</option>
                  <option value="EVERYONE">Everyone</option>
                </select>
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                    About Me
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiBioModal(true);
                      if (aiBioSuggestions.length === 0) handleGenerateAiBio('creative');
                    }}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-[11px] font-bold transition-all hover:scale-105"
                  >
                    <IconWand size={13} />
                    <span>AI Bio Generator ✨</span>
                  </button>
                </div>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {cleanBioText.length} / 500 characters
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={cleanBioText}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, bio: formatBioWithInterests(e.target.value, selectedInterests) } : null
                  )
                }
                placeholder="Tell potential matches about yourself..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/60 transition-colors resize-none text-sm leading-relaxed shadow-inner"
              />
            </div>

            {/* Voice Bio Section */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconMicrophone size={18} className="text-rose-500" />
                  <span className="text-xs font-bold text-white">Voice Bio (Audio Intro)</span>
                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                    20s Max
                  </span>
                </div>
                {voiceBioUrl && (
                  <button
                    type="button"
                    onClick={handleDeleteVoiceBio}
                    className="text-[11px] text-neutral-500 hover:text-rose-400 flex items-center gap-1 font-semibold"
                  >
                    <IconTrash size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {voiceBioUrl ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={isPlayingVoice ? pauseVoiceBio : playVoiceBio}
                      className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-transform active:scale-95"
                    >
                      {isPlayingVoice ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} className="ml-0.5" />}
                    </button>
                    <div>
                      <span className="text-xs font-bold text-white block">Your Voice Introduction</span>
                      <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                        <IconVolume size={13} /> Playable on candidate card
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[40, 70, 90, 60, 80, 50, 95, 65, 45, 85].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full bg-rose-500 transition-all ${isPlayingVoice ? 'animate-pulse' : 'opacity-60'}`}
                        style={{ height: `${h * 0.25}px` }}
                      />
                    ))}
                  </div>
                </div>
              ) : isRecordingVoice ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-950/40 border border-rose-800/60">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-rose-400">
                      Recording audio... {recordingSeconds}s / 20s
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white rounded-lg transition-colors"
                  >
                    Done Recording
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-400">
                    Record a friendly 10-20s voice snippet so matches hear your real vibe!
                  </p>
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold hover:bg-rose-500/30 transition-all shrink-0 ml-2"
                  >
                    <IconMicrophone size={14} />
                    <span>Record Voice</span>
                  </button>
                </div>
              )}
            </div>


            {/* Passions & Interests */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <IconSparkles size={18} className="text-amber-400" />
                    <span>Passions & Interests</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Pick up to 6 interests for your card
                  </p>
                </div>
                <span className="text-xs text-neutral-500 font-semibold">
                  {selectedInterests.length} / 6
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {POPULAR_INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      onClick={() => toggleInterest(interest.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${isSelected
                        ? 'bg-gradient-to-r from-rose-600 to-amber-600 border-rose-500 text-white shadow-md shadow-rose-950/40 scale-105'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                        }`}
                    >
                      {interest.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Profile */}
            <div className="pt-4 border-t border-neutral-800/80">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:opacity-95 font-bold py-3.5 rounded-xl transition-all shadow-xl shadow-rose-950/50 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                {saving ? 'Saving Changes...' : 'Save Basic Profile ✨'}
              </button>
            </div>
          </form>


          {/* Interactive Two Truths & A Lie Setup */}
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl space-y-5">
            <div className="pb-2 border-b border-neutral-800/60">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <IconFlame size={22} className="text-rose-500" />
                <span>Two Truths & A Lie Game</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Matches can guess the Lie right on your Discover card to break the ice!
              </p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Statement 1', val: truth1, setter: setTruth1, idx: 0 },
                { label: 'Statement 2', val: truth2, setter: setTruth2, idx: 1 },
                { label: 'Statement 3', val: truth3, setter: setTruth3, idx: 2 },
              ].map((item) => (
                <div key={item.idx} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="lieSelector"
                    checked={lieIndex === item.idx}
                    onChange={() => setLieIndex(item.idx)}
                    className="w-4 h-4 text-rose-500 cursor-pointer accent-rose-500 shrink-0"
                    title="Mark this as the LIE"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => item.setter(e.target.value)}
                      placeholder={`${item.label} (e.g. ${item.idx === 0 ? "I've visited 12 countries" : item.idx === 1 ? 'I am a certified scuba diver' : 'I hate chocolate'})`}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500 shadow-inner"
                    />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${lieIndex === item.idx ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-500'}`}>
                    {lieIndex === item.idx ? 'THE LIE ❌' : 'TRUTH ✓'}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-neutral-400">
              Select the radio button next to the statement that is the <strong className="text-rose-400">Lie</strong>.
            </p>
          </section>

          {/* Passport & Privacy Settings */}
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl space-y-5">
            <div className="pb-2 border-b border-neutral-800/60">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <IconPlane size={22} className="text-sky-400" />
                <span>Passport & Ghost Mode</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Control your travel discovery location and stealth visibility
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Passport City (Travel Mode)
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-sky-500 text-xs font-medium cursor-pointer shadow-inner"
                >
                  {PASSPORT_CITIES.map((c, i) => (
                    <option key={i} value={c.city}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <input
                    type="checkbox"
                    checked={isIncognito}
                    onChange={(e) => setIsIncognito(e.target.checked)}
                    className="w-4 h-4 text-rose-500 rounded accent-rose-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Ghost / Incognito Mode</span>
                    <span className="text-[10px] text-neutral-400 block">Only people you like will see your profile</span>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveExtended}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-rose-600 hover:opacity-95 font-bold text-xs text-white shadow-lg transition-all"
            >
              {saving ? 'Saving...' : 'Save Features & Privacy Settings'}
            </button>
          </section>

          {/* Blocked Users Section */}
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <IconBan size={22} className="text-neutral-400" />
                <span>Blocked Accounts</span>
              </h2>
              <span className="text-xs text-neutral-500 font-semibold">{blockedUsers.length} Blocked</span>
            </div>

            {blockedUsers.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-4">No blocked profiles</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center text-neutral-400">
                        {b.blocked?.photos?.[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.blocked.photos[0].url} alt="Blocked user" className="w-full h-full object-cover" />
                        ) : (
                          <IconUser size={16} />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white">{b.blocked?.name || 'Blocked User'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnblockUser(b.blockedId || b.id)}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 rounded-lg transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Completeness Meter + Photos & Media */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-8">
          {/* Completeness Meter */}
          <section className="bg-neutral-900/80 border border-neutral-800/90 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconSparkles size={20} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">Profile Strength</h3>
              </div>
              <span className="text-sm font-extrabold text-rose-400">{completenessScore}%</span>
            </div>

            <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden mb-4 border border-neutral-800/60">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 transition-all duration-500 rounded-full shadow-inner"
                style={{ width: `${completenessScore}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-neutral-400">
              <span className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border ${photos.length >= 3 ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400' : 'border-neutral-800 bg-neutral-950/50'}`}>
                {photos.length >= 3 ? <IconCheck size={13} /> : null} 3+ Photos ({photos.length}/3)
              </span>

              <span className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border ${cleanBioText.length > 10 ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400' : 'border-neutral-800 bg-neutral-950/50'}`}>
                {cleanBioText.length > 10 ? <IconCheck size={13} /> : null} Detailed Bio
              </span>

              <span className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border ${profile?.isVerified ? 'border-sky-800/60 bg-sky-950/40 text-sky-400' : 'border-neutral-800 bg-neutral-950/50'}`}>
                {profile?.isVerified ? <IconCheck size={13} /> : null} Verified Badge
              </span>
            </div>
          </section>

          {/* Photos & Media Section */}
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <IconPhoto size={22} className="text-rose-500" />
                  <span>Photos & Media</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Upload up to 6 photos. First photo is main avatar.
                </p>
              </div>
              <span className="px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-full text-xs font-semibold text-neutral-400">
                {photos.length} / 6
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="aspect-[3/4] relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 group shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Profile photo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />

                  {idx === 0 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-rose-600/90 backdrop-blur-md text-white text-[9px] font-extrabold rounded-md shadow-md flex items-center gap-1">
                      <IconStar size={10} className="fill-white" />
                      <span>MAIN</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={deletingPhotoId === photo.id}
                      className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all transform hover:scale-110 shadow-lg disabled:opacity-50 cursor-pointer"
                      title="Delete photo"
                    >
                      {deletingPhotoId === photo.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <IconTrash size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {photos.length < 6 && (
                <label className="aspect-[3/4] flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 hover:border-rose-500/70 rounded-2xl cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/80 transition-all text-neutral-400 hover:text-white group p-3 text-center">
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <div className="p-2.5 bg-neutral-800/80 rounded-full group-hover:bg-rose-500/20 group-hover:text-rose-400 transition-colors mb-1.5 shadow-inner">
                        <IconPlus size={20} />
                      </div>
                      <span className="text-xs font-bold text-neutral-300 group-hover:text-white">Add Photo</span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">JPEG/PNG</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Verification Selfie Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <IconShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Get Blue Badge Verified</h3>
                  <p className="text-xs text-neutral-400">Prove authenticity and get 3x more matches</p>
                </div>
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="text-neutral-400 hover:text-white">
                <IconX size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-3">
              <div className="w-24 h-24 rounded-full bg-neutral-900 border-2 border-dashed border-sky-500/50 mx-auto flex items-center justify-center text-sky-400">
                <IconCamera size={36} />
              </div>
              <p className="text-xs text-neutral-300">
                Hold your phone at eye level and match the pose. Once submitted, our AI safety engine will verify your profile.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="py-2.5 rounded-xl bg-neutral-800 text-xs font-semibold text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerificationSubmit}
                disabled={submittingVerify}
                className="py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white shadow-lg shadow-sky-500/30"
              >
                {submittingVerify ? 'Verifying...' : 'Take & Submit Selfie 📸'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* AI Bio Generator Modal */}
      {showAiBioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <IconWand size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Dating Bio Assistant</h3>
                  <p className="text-xs text-neutral-400">Generate creative bios tailored to your passions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiBioModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Vibe Selector Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(['creative', 'funny', 'romantic', 'adventurous'] as const).map((vibe) => (
                <button
                  key={vibe}
                  type="button"
                  onClick={() => {
                    setAiBioVibe(vibe);
                    handleGenerateAiBio(vibe);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                    aiBioVibe === vibe
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-rose-950/40'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {vibe === 'creative' ? '✨ Creative' : vibe === 'funny' ? '😂 Funny & Witty' : vibe === 'romantic' ? '💖 Romantic' : '🏕️ Adventurous'}
                </button>
              ))}
            </div>

            {/* Suggestions List */}
            {generatingAiBio ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">AI is crafting customized dating bios...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {aiBioSuggestions.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 hover:border-amber-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        {item.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyAiBio(item.bio)}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all"
                      >
                        Use This Bio ✓
                      </button>
                    </div>
                    <p className="text-xs text-neutral-200 leading-relaxed font-medium">{item.bio}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleGenerateAiBio(aiBioVibe)}
                disabled={generatingAiBio}
                className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>🔄 Regenerate Options</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAiBioModal(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

