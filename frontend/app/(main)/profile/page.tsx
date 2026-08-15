'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { IconUser, IconLogout, IconPlus, IconPhoto } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthContext';

type UserProfile = {
  name: string;
  gender: string;
  preference: string;
  bio?: string;
  photos?: { id: string; url: string; order: number }[];
};

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    api
      .getMe()
      .then((res) => {
        setProfile({
          ...(res.profile || {}),
          photos: res.photos || res.profile?.photos || [],
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load profile data');
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
      const interestedInArray =
        profile.preference === 'EVERYONE'
          ? ['MALE', 'FEMALE', 'NONBINARY', 'OTHER']
          : [profile.preference || 'FEMALE'];

      await api.updateProfile({
        name: profile.name,
        dob: (profile as any).dob || '2000-01-01T00:00:00.000Z',
        gender: profile.gender || 'MALE',
        interestedIn: interestedInArray,
        bio: profile.bio || '',
      });
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
      const updatedUser = await api.getMe();
      setProfile({
        ...(updatedUser.profile || {}),
        photos: updatedUser.photos || updatedUser.profile?.photos || [],
      });
      toast.success('Photo uploaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed', { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleLogout() {
    logout();
    toast.success('Signed out successfully');
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-ember border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <IconUser size={28} className="text-ember" />
            <span>Your Profile</span>
          </h1>
          <p className="text-sm text-neutral-400">Manage your profile details and preferences</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-xl hover:bg-rose-900/40 transition-colors"
        >
          <IconLogout size={16} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Photos Grid */}
      <section className="mb-8 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <IconPhoto size={20} className="text-neutral-400" />
          <span>Photos</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {profile?.photos?.map((photo) => (
            <div
              key={photo.id}
              className="aspect-[3/4] relative rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700/50 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Profile photo" className="w-full h-full object-cover" />
            </div>
          ))}
          {(!profile?.photos || profile.photos.length < 6) && (
            <label className="aspect-[3/4] flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 hover:border-ember rounded-xl cursor-pointer bg-neutral-900/50 transition-colors text-neutral-400 hover:text-white">
              {uploadingPhoto ? (
                <div className="w-6 h-6 border-2 border-ember border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <IconPlus size={24} className="mb-1" />
                  <span className="text-xs font-medium">Add Photo</span>
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

      {/* Profile Form */}
      <form
        onSubmit={handleSave}
        className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 backdrop-blur-sm space-y-5"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={profile?.name || ''}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, name: e.target.value } : null))}
            required
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Gender
            </label>
            <select
              value={profile?.gender || 'MALE'}
              onChange={(e) => setProfile((prev) => (prev ? { ...prev, gender: e.target.value } : null))}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors"
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
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors"
            >
              <option value="MALE">Men</option>
              <option value="FEMALE">Women</option>
              <option value="EVERYONE">Everyone</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Bio
          </label>
          <textarea
            rows={4}
            value={profile?.bio || ''}
            onChange={(e) => setProfile((prev) => (prev ? { ...prev, bio: e.target.value } : null))}
            placeholder="Tell potential matches about yourself..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-ember transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-ember to-rose-600 hover:from-rose-600 hover:to-ember font-medium py-3 rounded-xl transition-all shadow-lg shadow-ember/20 disabled:opacity-50 text-white"
        >
          {saving ? 'Saving Changes...' : 'Save Profile'}
        </button>
      </form>
    </main>
  );
}

