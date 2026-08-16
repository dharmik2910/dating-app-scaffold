'use client';

import { useEffect, useState } from 'react';
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
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';

type PhotoItem = { id: string; url: string; order: number };

type UserProfile = {
  name: string;
  gender: string;
  preference: string;
  bio?: string;
  photos?: PhotoItem[];
  interests?: string[];
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

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await api.getMe();
      const userPhotos = res.photos || res.profile?.photos || [];
      const userBio = res.profile?.bio || '';

      const parsedInterests = parseInterestsFromBio(userBio);

      setProfile({
        ...(res.profile || {}),
        photos: userPhotos,
      });

      setSelectedInterests(parsedInterests.interests);
      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile data');
      setLoading(false);
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

  // Completeness score logic
  const calculateCompleteness = () => {
    if (!profile) return 0;
    let score = 0;
    const cleanBio = getCleanBioDisplay(profile.bio);

    if (profile.name?.trim()) score += 20;
    if (profile.photos && profile.photos.length >= 1) score += 25;
    if (profile.photos && profile.photos.length >= 3) score += 15;
    if (cleanBio.length > 10) score += 20;
    if (selectedInterests.length >= 3) score += 20;

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
      });

      setProfile((prev) => (prev ? { ...prev, bio: fullBio } : null));
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
        prev
          ? {
            ...prev,
            photos: prev.photos?.filter((p) => p.id !== photoId),
          }
          : null
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
    return (
      <main className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-2 border-ember border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-neutral-400">Loading profile...</p>
      </main>
    );
  }

  const cleanBioText = getCleanBioDisplay(profile?.bio);
  const photos = profile?.photos || [];

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <IconUser size={30} className="text-ember" />
            <span>Profile Studio</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage your profile details, media, and preferences
          </p>
        </div>

        {/* <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-xl hover:bg-rose-900/40 transition-colors"
        >
          <IconLogout size={16} />
          <span className="hidden sm:inline">Sign Out</span>
        </button> */}
      </div>

      {/* Completeness Meter */}
      <section className="mb-8 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconSparkles size={18} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Profile Strength</h3>
          </div>
          <span className="text-sm font-bold text-rose-400">{completenessScore}%</span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-ember to-rose-500 transition-all duration-500 rounded-full"
            style={{ width: `${completenessScore}%` }}
          />
        </div>

        {/* Completion Tips */}
        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-neutral-400">
          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${photos.length >= 3
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-400'
                : 'border-neutral-800 bg-neutral-950/50 text-neutral-400'
              }`}
          >
            {photos.length >= 3 ? <IconCheck size={12} /> : null} 3+ Photos ({photos.length}/3)
          </span>

          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${cleanBioText.length > 10
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-400'
                : 'border-neutral-800 bg-neutral-950/50 text-neutral-400'
              }`}
          >
            {cleanBioText.length > 10 ? <IconCheck size={12} /> : null} Detailed Bio
          </span>

          <span
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border ${selectedInterests.length >= 3
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-400'
                : 'border-neutral-800 bg-neutral-950/50 text-neutral-400'
              }`}
          >
            {selectedInterests.length >= 3 ? <IconCheck size={12} /> : null} 3+ Passions (
            {selectedInterests.length}/3)
          </span>
        </div>
      </section>

      {/* EDIT PROFILE FORM & MANAGERS */}
      <div className="space-y-8">
        {/* Photos Management */}
        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <IconPhoto size={20} className="text-ember" />
                <span>Photos & Media</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Upload up to 6 photos. The first photo will be your main profile photo.
              </p>
            </div>
            <span className="text-xs text-neutral-500 font-medium">{photos.length} / 6</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="aspect-[3/4] relative rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700/60 group shadow-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Profile photo" className="w-full h-full object-cover" />

                {/* Main Avatar Badge */}
                {idx === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-ember/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-md shadow flex items-center gap-1">
                    <IconStar size={10} className="fill-white" />
                    <span>MAIN</span>
                  </div>
                )}

                {/* Overlay Delete Action */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingPhotoId === photo.id}
                    className="p-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full transition-transform transform hover:scale-110 shadow-lg disabled:opacity-50 cursor-pointer"
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

            {/* Upload Slot */}
            {photos.length < 6 && (
              <label className="aspect-[3/4] flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 hover:border-ember rounded-xl cursor-pointer bg-neutral-900/50 hover:bg-neutral-950/80 transition-all text-neutral-400 hover:text-white group">
                {uploadingPhoto ? (
                  <div className="w-6 h-6 border-2 border-ember border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="p-3 bg-neutral-800/60 rounded-full group-hover:bg-ember/20 group-hover:text-ember transition-colors mb-1.5">
                      <IconPlus size={22} />
                    </div>
                    <span className="text-xs font-semibold">Add Photo</span>
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

        {/* Passions & Interests Selector */}
        <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <IconSparkles size={20} className="text-amber-400" />
                <span>Passions & Interests</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pick up to 6 interests to display on your match card
              </p>
            </div>
            <span className="text-xs text-neutral-500 font-medium">
              {selectedInterests.length} / 6 selected
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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${isSelected
                      ? 'bg-gradient-to-r from-ember to-rose-600 border-rose-500 text-white shadow-md shadow-rose-900/30 scale-105'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                    }`}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Profile Form */}
        <form
          onSubmit={handleSave}
          className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-6 backdrop-blur-sm space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={profile?.name || ''}
              onChange={(e) => setProfile((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              placeholder="Your name"
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Gender
              </label>
              <select
                value={profile?.gender || 'MALE'}
                onChange={(e) => setProfile((prev) => (prev ? { ...prev, gender: e.target.value } : null))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors text-sm cursor-pointer"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="NONBINARY">Non-Binary</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Interested In
              </label>
              <select
                value={profile?.preference || 'FEMALE'}
                onChange={(e) => setProfile((prev) => (prev ? { ...prev, preference: e.target.value } : null))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors text-sm cursor-pointer"
              >
                <option value="MALE">Men</option>
                <option value="FEMALE">Women</option>
                <option value="EVERYONE">Everyone</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Bio
              </label>
              <span className="text-[11px] text-neutral-500">
                {cleanBioText.length} / 500 characters
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              value={cleanBioText}
              onChange={(e) =>
                setProfile((prev) =>
                  prev
                    ? {
                      ...prev,
                      bio: formatBioWithInterests(e.target.value, selectedInterests),
                    }
                    : null
                )
              }
              placeholder="Tell potential matches about your hobbies, passions, or what makes you smile..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-ember transition-colors resize-none text-sm leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-ember to-rose-600 hover:from-rose-600 hover:to-ember font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-950/50 disabled:opacity-50 text-white cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <span>Save Profile Updates</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
