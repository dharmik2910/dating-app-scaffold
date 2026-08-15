'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { needsOnboarding } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';

const inputClass =
  'w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-ember';
const labelClass = 'block text-sm text-neutral-400 mb-1.5';

const GENDERS = [
  { value: 'male', label: 'Man' },
  { value: 'female', label: 'Woman' },
  { value: 'non-binary', label: 'Non-binary' },
];

const INTERESTS = GENDERS;

type PhotoPreview = { file: File; preview: string };

export default function SetupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
      return;
    }

    api
      .getMe()
      .then((user) => {
        if (!needsOnboarding(user)) {
          router.replace('/discover');
          return;
        }
        setChecking(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  function toggleInterest(value: string) {
    setInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const next = files.slice(0, 6 - photos.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...next].slice(0, 6));
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function requestLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLoading(false);
      },
      () => {
        setError('Could not get your location. Check browser permissions.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function finishSetup(skipPhotos = false) {
    if (!name || !dob || !gender || interestedIn.length === 0) {
      setError('Please fill in all required fields.');
      return;
    }
    if (latitude == null || longitude == null) {
      setError('Location is required so we can show nearby profiles.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.updateProfile({
        name,
        dob,
        gender,
        bio: bio || undefined,
        interestedIn,
        latitude,
        longitude,
      });

      if (!skipPhotos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          await api.uploadPhoto(photos[i].file, i);
        }
      }

      await refreshUser();
      router.push('/discover');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-8">
        <div>
          <p className="text-sm text-ember font-medium">Step {step} of 4</p>
          <h1 className="text-2xl font-semibold mt-1">
            {step === 1 && 'Tell us about you'}
            {step === 2 && 'Who are you interested in?'}
            {step === 3 && 'Enable location'}
            {step === 4 && 'Add your photos'}
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            {step === 1 && 'This helps us build your profile.'}
            {step === 2 && 'Pick one or more options.'}
            {step === 3 && 'We only use this to show people nearby.'}
            {step === 4 && 'Profiles with photos get more matches.'}
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>First name</label>
              <input
                className={inputClass}
                placeholder="Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Date of birth</label>
              <input
                type="date"
                className={inputClass}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>I am a</label>
              <div className="grid grid-cols-3 gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(g.value)}
                    className={`rounded-lg border py-3 text-sm transition-colors ${
                      gender === g.value
                        ? 'border-ember bg-ember/10 text-ember'
                        : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Show me</label>
              <div className="grid grid-cols-3 gap-2">
                {INTERESTS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleInterest(g.value)}
                    className={`rounded-lg border py-3 text-sm transition-colors ${
                      interestedIn.includes(g.value)
                        ? 'border-ember bg-ember/10 text-ember'
                        : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Bio (optional)</label>
              <textarea
                className={`${inputClass} min-h-[100px] resize-none`}
                placeholder="A little about you..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={requestLocation}
              disabled={loading}
              className="w-full rounded-lg bg-ember hover:bg-ember-dark transition-colors py-3 font-medium disabled:opacity-50"
            >
              {loading ? 'Getting location...' : 'Use my current location'}
            </button>
            {latitude != null && longitude != null && (
              <p className="text-sm text-green-400 text-center">
                Location set ({latitude.toFixed(4)}, {longitude.toFixed(4)})
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo, i) => (
                <div key={photo.preview} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-neutral-900">
                  <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="aspect-[3/4] rounded-lg border border-dashed border-neutral-700 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-500 transition-colors">
                  <span className="text-2xl text-neutral-500">+</span>
                  <span className="text-xs text-neutral-500 mt-1">Add photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-neutral-700 py-3 font-medium hover:bg-neutral-900 transition-colors"
            >
              Back
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              disabled={
                (step === 1 && (!name || !dob || !gender)) ||
                (step === 2 && interestedIn.length === 0) ||
                (step === 3 && (latitude == null || longitude == null))
              }
              onClick={() => {
                setError('');
                setStep((s) => s + 1);
              }}
              className="flex-1 rounded-lg bg-ember hover:bg-ember-dark transition-colors py-3 font-medium disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => finishSetup(false)}
                className="w-full rounded-lg bg-ember hover:bg-ember-dark transition-colors py-3 font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Finish & start swiping'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => finishSetup(true)}
                className="w-full text-sm text-neutral-400 hover:text-neutral-200 py-1"
              >
                Skip photos for now
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
