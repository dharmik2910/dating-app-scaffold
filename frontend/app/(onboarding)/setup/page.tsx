'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { needsOnboarding } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import {
  IconSparkles,
  IconMapPin,
  IconCamera,
  IconCheck,
  IconUser,
  IconHeart,
  IconChevronRight,
  IconChevronLeft,
  IconStar,
  IconInfoCircle,
  IconWorld,
  IconShieldCheck,
  IconFlame,
  IconTrash,
  IconPlus,
  IconCompass,
  IconSearch,
  IconPencil,
  IconChevronDown,
  IconX,
} from '@tabler/icons-react';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];


const INTEREST_OPTIONS = [
  { value: 'male', label: 'Men', icon: '👨' },
  { value: 'female', label: 'Women', icon: '👩' },
  { value: 'other', label: 'Everyone', icon: '🌈' },
];


const RELATIONSHIP_INTENTS = [
  { value: 'long-term', label: 'Long-term relationship', emoji: '💞' },
  { value: 'dating', label: 'Dating & seeing where it goes', emoji: '🥂' },
  { value: 'casual', label: 'Casual & fun', emoji: '✨' },
  { value: 'friends', label: 'New friends', emoji: '🤝' },
  { value: 'other', label: 'Other (Custom)', emoji: '✏️' },
];

const PASSION_TAGS = [
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'fitness', label: '🏋️ Fitness' },
  { id: 'music', label: '🎧 Music' },
  { id: 'foodie', label: '🍕 Foodie' },
  { id: 'movies', label: '🎬 Movies' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'art', label: '🎨 Art' },
];



const PROMPT_STARTERS = [
  'A fun fact about me...',
  'My ideal Sunday looks like...',
  'Looking for someone who...',
  'Never have I ever...',
];

const POPULAR_CITIES = [
  { name: 'Surat, India', lat: 21.1702, lng: 72.8311 },
  { name: 'Ahmedabad, India', lat: 23.0225, lng: 72.5714 },
  { name: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi, India', lat: 28.6139, lng: 77.209 },
  { name: 'Bengaluru, India', lat: 12.9716, lng: 77.5946 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'New York, NY', lat: 40.7128, lng: -74.006 },
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
];


type PhotoPreview = { file: File; preview: string };

export default function SetupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<string>('');
  const [customIntentText, setCustomIntentText] = useState<string>('');
  const [selectedPassions, setSelectedPassions] = useState<string[]>([]);
  const [customPassionInput, setCustomPassionInput] = useState<string>('');
  const [isAddingCustomPassion, setIsAddingCustomPassion] = useState<boolean>(false);
  const [bio, setBio] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationCityName, setLocationCityName] = useState<string>('');
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);

  function handleAddCustomPassion() {
    const trimmed = customPassionInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!selectedPassions.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedPassions((prev) => [...prev, trimmed]);
      toast.success(`Added "${trimmed}" to your passions! ✨`);
    }
    setCustomPassionInput('');
    setIsAddingCustomPassion(false);
  }

  function handleSelectPassionFromDropdown(id: string) {
    if (!id) return;
    if (id === 'other_custom') {
      setIsAddingCustomPassion(true);
      return;
    }
    if (!selectedPassions.includes(id)) {
      setSelectedPassions((prev) => [...prev, id]);
      toast.success('Passion added! ✨');
    }
  }

  function removePassion(tagId: string) {
    setSelectedPassions((prev) => prev.filter((p) => p !== tagId));
  }

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
        // Pre-fill existing user info if available
        if (user.profile) {
          if (user.profile.name) setName(user.profile.name);
          if (user.profile.gender) setGender(user.profile.gender);
          if (user.profile.interestedIn) setInterestedIn(user.profile.interestedIn);
          if (user.profile.latitude != null) setLatitude(user.profile.latitude);
          if (user.profile.longitude != null) setLongitude(user.profile.longitude);
        }
        setChecking(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  // Calculate age from date of birth
  const calculatedAge = useMemo(() => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [dob]);

  const isAgeValid = calculatedAge !== null && calculatedAge >= 18 && calculatedAge <= 110;

  function toggleInterest(value: string) {
    setError('');
    setInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function togglePassion(id: string) {
    setSelectedPassions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remainingSlots = 6 - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const next = filesToAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...next]);
    setError('');
    e.target.value = '';
  }

  function removePhoto(index: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    if (previewPhotoIndex >= index && previewPhotoIndex > 0) {
      setPreviewPhotoIndex((prev) => prev - 1);
    }
  }

  function setAsPrimaryPhoto(index: number) {
    if (index === 0) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      copy.unshift(selected);
      return copy;
    });
    setPreviewPhotoIndex(0);
    toast.success('Cover photo updated!');
  }

  async function fetchCityNameFromCoords(lat: number, lng: number): Promise<string> {
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        const city = data.city || data.locality || data.principalSubdivision;
        const country = data.countryName || data.countryCode;
        if (city) {
          return country ? `${city}, ${country}` : city;
        }
      }
    } catch (e) {
      console.warn('BigDataCloud reverse geocode error:', e);
    }

    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.state;
        const country = addr.country;
        if (city) {
          return country ? `${city}, ${country}` : city;
        }
      }
    } catch (e) {
      console.warn('OSM reverse geocode error:', e);
    }

    return 'Detected Location';
  }

  async function requestLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. You can select or search your city below.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setLocationCityName('Detecting city name...');

        try {
          const resolvedName = await fetchCityNameFromCoords(lat, lng);
          setLocationCityName(resolvedName);
          toast.success(`Location set: ${resolvedName} 📍`);
        } catch {
          setLocationCityName('Current Location');
          toast.success('Location detected! 📍');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Could not access GPS. Please search or pick your city below.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<
    { name: string; region?: string; fullName: string; lat: number; lng: number }[]
  >([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isEditingCityName, setIsEditingCityName] = useState(false);

  async function handleCitySearch(query: string) {
    setCitySearchQuery(query);
    if (!query.trim() || query.trim().length < 2) {
      setCitySearchResults([]);
      return;
    }

    setIsSearchingCity(true);
    try {
      // 1. Photon by Komoot: Searches ALL OpenStreetMap nodes including villages, hamlets, towns, districts
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=8`
      );
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData.features && photonData.features.length > 0) {
          const formatted = photonData.features.map((f: any) => {
            const p = f.properties;
            const regionParts = [p.district || p.county || p.city, p.state, p.country].filter(Boolean);
            const region = regionParts.join(', ');
            const fullName = [p.name, p.district || p.county, p.state, p.country].filter(Boolean).join(', ');
            return {
              name: p.name,
              region,
              fullName,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
            };
          });
          setCitySearchResults(formatted);
          return;
        }
      }

      // 2. OpenStreetMap Nominatim: Complete worldwide village, town, and street-level coverage
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query.trim()
        )}&limit=6&addressdetails=1`
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        if (data && data.length > 0) {
          const formatted = data.map((item: any) => {
            const addr = item.address || {};
            const mainName =
              addr.village ||
              addr.hamlet ||
              addr.suburb ||
              addr.town ||
              addr.city ||
              item.name ||
              item.display_name.split(',')[0];
            const regionParts = [
              addr.county || addr.district || addr.state_district,
              addr.state,
              addr.country,
            ].filter(Boolean);
            const region = regionParts.join(', ');
            const fullName = [mainName, ...regionParts].filter(Boolean).join(', ');
            return {
              name: mainName,
              region,
              fullName,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          setCitySearchResults(formatted);
          return;
        }
      }

      // 3. Open-Meteo Global Geocoding: Fast worldwide cities lookup
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query.trim()
        )}&count=6&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const formatted = data.results.map((item: any) => {
            const region = [item.admin1, item.country].filter(Boolean).join(', ');
            const fullName = [item.name, item.admin1, item.country].filter(Boolean).join(', ');
            return {
              name: item.name,
              region,
              fullName,
              lat: item.latitude,
              lng: item.longitude,
            };
          });
          setCitySearchResults(formatted);
          return;
        }
      }
    } catch (e) {
      console.warn('Location search error:', e);
    } finally {
      setIsSearchingCity(false);
    }
  }


  function selectCity(city: { name?: string; fullName?: string; lat: number; lng: number }) {
    const displayName = city.fullName || city.name || 'Selected City';
    setLatitude(city.lat);
    setLongitude(city.lng);
    setLocationCityName(displayName);
    setCitySearchQuery('');
    setCitySearchResults([]);
    setIsEditingCityName(false);
    setError('');
    toast.success(`Location set to ${displayName} 🌆`);
  }


  function appendPrompt(promptText: string) {
    if (bio.includes(promptText)) return;
    setBio((prev) => (prev ? `${prev}\n\n${promptText} ` : `${promptText} `));
  }

  // Construct formatted bio with passion tags metadata and city for Discover matching
  function buildFormattedBio() {
    let result = bio.trim();
    if (selectedPassions.length > 0) {
      result = `[INTERESTS:${selectedPassions.join(',')}] ${result}`;
    }
    if (locationCityName) {
      result = `[CITY:${locationCityName}] ${result}`;
    }
    return result;
  }


  function canProceedFromStep(stepNum: number) {
    if (stepNum === 1) {
      return Boolean(name.trim() && dob && isAgeValid && gender);
    }
    if (stepNum === 2) {
      return interestedIn.length > 0;
    }
    if (stepNum === 3) {
      return latitude != null && longitude != null;
    }
    if (stepNum === 4) {
      return true; // photos can be empty or added
    }
    return true;
  }

  async function finishSetup(skipPhotos = false) {
    if (!name || !dob || !gender || interestedIn.length === 0) {
      setError('Please fill in all required fields.');
      return;
    }
    if (latitude == null || longitude == null) {
      setError('Location is required so we can show nearby matches.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullBio = buildFormattedBio();

      await api.updateProfile({
        name: name.trim(),
        dob,
        gender,
        bio: fullBio || undefined,
        interestedIn,
        latitude,
        longitude,
      });

      if (!skipPhotos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          try {
            await api.uploadPhoto(photos[i].file, i);
          } catch (uploadErr) {
            console.warn(`Photo ${i + 1} upload issue:`, uploadErr);
          }
        }
      }

      await refreshUser();
      toast.success('Welcome to Ember! 🔥 Let the matches begin.');
      router.push('/discover');
    } catch (e: any) {
      setError(e.message || 'Something went wrong while saving your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
          <p className="text-sm font-medium text-neutral-400">Loading your profile...</p>
        </div>
      </main>
    );
  }

  const stepsList = [
    { num: 1, title: 'Basics', icon: IconUser },
    { num: 2, title: 'Vibe', icon: IconSparkles },
    { num: 3, title: 'Location', icon: IconMapPin },
    { num: 4, title: 'Photos', icon: IconCamera },
    { num: 5, title: 'Preview', icon: IconHeart },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-8 text-neutral-100 selection:bg-rose-500/30 overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-rose-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-orange-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-pink-600/5 blur-[160px]" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Top App Branding */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 via-pink-600 to-orange-500 shadow-md shadow-rose-600/20">
              <IconFlame size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Ember
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-neutral-400 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className="text-rose-400">Step {step}</span>
            <span>of 5</span>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="mb-8">
          <div className="relative flex items-center justify-between">
            {/* Progress line */}
            <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-neutral-800 rounded-full z-0" />
            <div
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 rounded-full transition-all duration-500 z-0"
              style={{ width: `${((step - 1) / (stepsList.length - 1)) * 100}%` }}
            />

            {stepsList.map((s) => {
              const Icon = s.icon;
              const isPast = step > s.num;
              const isCurrent = step === s.num;

              return (
                <div
                  key={s.num}
                  className="relative z-10 flex flex-col items-center cursor-pointer select-none"
                  onClick={() => {
                    if (isPast) {
                      setError('');
                      setStep(s.num);
                    }
                  }}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${isCurrent
                      ? 'border-rose-500 bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-4 ring-rose-500/20 scale-110'
                      : isPast
                        ? 'border-rose-500/60 bg-rose-950/80 text-rose-300'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-500'
                      }`}
                  >
                    {isPast ? <IconCheck size={16} stroke={3} /> : <Icon size={16} />}
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] font-medium hidden sm:block transition-colors ${isCurrent ? 'text-white font-semibold' : isPast ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                  >
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-neutral-800/80 bg-neutral-900/70 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all">
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Tell us about you</span>
                  <span className="text-xl">✨</span>
                </h1>
                <p className="mt-1 text-sm text-neutral-400">
                  Let’s start with the basics so matches know who you are.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                  <span>Full Name</span>
                  <span className="text-[11px] text-neutral-500 lowercase">shown on profile</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="e.g. Alex Sharma"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError('');
                    }}
                    className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 text-base font-medium text-white placeholder-neutral-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                  {name.trim() && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-400 flex items-center gap-1">
                      <IconCheck size={14} /> Hey, {name.trim()}!
                    </span>
                  )}
                </div>
              </div>


              {/* Date of Birth */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Date of Birth
                  </label>
                  {calculatedAge !== null && (
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${isAgeValid
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-red-500/30 bg-red-500/10 text-red-400'
                        }`}
                    >
                      {isAgeValid ? `🎉 ${calculatedAge} years old` : 'Must be 18+'}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={dob}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setError('');
                  }}
                  className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 text-sm font-medium text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer"
                />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  GENDER
                </label>
                <div className="flex items-center rounded-2xl bg-neutral-950/90 border border-neutral-800 p-1">
                  {GENDERS.map((g) => {
                    const isSelected = gender === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => {
                          setGender(g.value);
                          setError('');
                        }}
                        className={`flex-1 py-3 text-center text-sm transition-all rounded-xl ${isSelected
                            ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/25'
                            : 'text-neutral-400 font-medium hover:text-white'
                          }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: Vibe, Interests & Bio */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Your Vibe & Preferences</span>
                  <span className="text-xl">💫</span>
                </h1>
                <p className="mt-1 text-sm text-neutral-400">
                  Set who you want to discover and pick things you love.
                </p>
              </div>

              {/* Who are you interested in */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                  <span>Show me</span>
                  <span className="text-[11px] text-neutral-500 lowercase">select all that apply</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {INTEREST_OPTIONS.map((g) => {
                    const isSelected = interestedIn.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => toggleInterest(g.value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 px-2 text-sm font-semibold transition-all ${isSelected
                          ? 'border-rose-500 bg-rose-500/15 text-rose-300 shadow-sm shadow-rose-500/20'
                          : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                          }`}
                      >
                        <span>{g.icon}</span>
                        <span>{g.label}</span>
                        {isSelected && <IconCheck size={14} className="text-rose-400 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Relationship Intent (Dropdown List) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Looking for
                </label>
                <div className="relative">
                  <select
                    value={selectedIntent}
                    onChange={(e) => setSelectedIntent(e.target.value)}
                    className="h-12 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950/90 px-4 pr-10 text-sm font-medium text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    <option value="" disabled className="bg-neutral-900 text-neutral-500">
                      ✨ Select what you&apos;re looking for...
                    </option>
                    {RELATIONSHIP_INTENTS.map((intent) => (
                      <option key={intent.value} value={intent.value} className="bg-neutral-900 text-white py-2">
                        {intent.emoji} {intent.label}
                      </option>
                    ))}
                  </select>

                  <IconChevronDown
                    size={18}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                </div>

                {/* Custom Other Intent Input */}
                {selectedIntent === 'other' && (
                  <div className="animate-in fade-in duration-200">
                    <input
                      type="text"
                      maxLength={50}
                      placeholder="Specify what you're looking for (e.g. Activity partner, Serious dating)..."
                      value={customIntentText}
                      onChange={(e) => setCustomIntentText(e.target.value)}
                      className="h-11 w-full rounded-xl border border-rose-500/50 bg-neutral-950/80 px-4 text-xs font-medium text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Passion / Interest Dropdown & Custom Badges */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Passions & Lifestyle
                  </label>
                  <span className="text-[11px] text-neutral-400">
                    {selectedPassions.length} chosen
                  </span>
                </div>

                {/* Dropdown Selector */}
                <div className="relative">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      handleSelectPassionFromDropdown(e.target.value);
                      e.target.value = '';
                    }}
                    className="h-12 w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950/90 px-4 pr-10 text-sm font-medium text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    <option value="" disabled className="bg-neutral-900 text-neutral-500">
                      ✨ Select a passion to add...
                    </option>
                    {PASSION_TAGS.map((tag) => (
                      <option
                        key={tag.id}
                        value={tag.id}
                        disabled={selectedPassions.includes(tag.id)}
                        className={`bg-neutral-900 py-1.5 ${selectedPassions.includes(tag.id) ? 'text-neutral-600' : 'text-white'
                          }`}
                      >
                        {selectedPassions.includes(tag.id) ? `✓ ${tag.label} (Added)` : tag.label}
                      </option>
                    ))}
                    <option value="other_custom" className="bg-neutral-900 text-rose-400 font-bold">
                      ➕ + Add Custom / Other Passion...
                    </option>
                  </select>
                  <IconChevronDown
                    size={18}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                </div>

                {/* Custom Passion Typing Bar */}
                {isAddingCustomPassion ? (
                  <div className="flex items-center gap-2 animate-in fade-in duration-200">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Type your hobby or passion (e.g. Scuba diving, Guitar)..."
                      value={customPassionInput}
                      onChange={(e) => setCustomPassionInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPassion()}
                      className="h-10 flex-1 rounded-xl border border-rose-500/60 bg-neutral-950/90 px-3 text-xs text-white placeholder-neutral-500 outline-none focus:ring-1 focus:ring-rose-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPassion}
                      className="h-10 px-3.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomPassion(false)}
                      className="h-10 px-2.5 text-neutral-400 hover:text-white text-xs rounded-xl transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomPassion(true)}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                    >
                      <span>+ Add custom passion</span>
                    </button>
                  </div>
                )}

                {/* Selected Passion Chips */}
                {selectedPassions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedPassions.map((tagId) => {
                      const tag = PASSION_TAGS.find((p) => p.id === tagId);
                      const displayLabel = tag ? tag.label : `✨ ${tagId}`;

                      return (
                        <span
                          key={tagId}
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-200 shadow-sm"
                        >
                          <span>{displayLabel}</span>
                          <button
                            type="button"
                            onClick={() => removePassion(tagId)}
                            className="text-rose-300/80 hover:text-white hover:bg-rose-500/40 p-0.5 rounded-full transition-colors"
                            title="Remove"
                          >
                            <IconX size={13} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bio & Prompt Starters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    About you (Bio)
                  </label>
                  <span className="text-[11px] text-neutral-500">{bio.length}/300</span>
                </div>

                {/* Prompt Starters */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {PROMPT_STARTERS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => appendPrompt(prompt)}
                      className="text-[10px] font-medium text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 px-2 py-1 rounded-md transition-colors"
                    >
                      + &quot;{prompt}&quot;
                    </button>
                  ))}
                </div>

                <textarea
                  maxLength={300}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all min-h-[90px] resize-none"
                  placeholder="Share a fun detail, your favorite travel story, or what makes you smile..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Location */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                {/* Radar Animated Pin Illustration */}
                <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-pulse-slow" />
                  <div className="absolute inset-3 rounded-full bg-rose-500/30 animate-ping opacity-25" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 shadow-xl shadow-rose-600/30 ring-4 ring-neutral-900">
                    <IconMapPin size={28} className="text-white" />
                  </div>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Find People Near You
                </h1>
                <p className="mt-1.5 text-sm text-neutral-400 max-w-sm mx-auto">
                  We use your location to calculate distance and show matches in your area.
                </p>
              </div>

              {/* One-Tap GPS Button */}
              <button
                type="button"
                onClick={requestLocation}
                disabled={loading}
                className="group relative flex h-13 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 py-3.5"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Detecting city name...</span>
                  </div>
                ) : (
                  <>
                    <IconCompass size={18} />
                    <span>Use My Current Location</span>
                  </>
                )}
              </button>

              {/* Location Feedback Card with Real City Name */}
              {latitude != null && longitude != null && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2 text-emerald-400 animate-in fade-in duration-300 shadow-inner">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                        <IconMapPin size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] uppercase tracking-wider text-emerald-500 font-bold block">
                          Your Selected City
                        </span>

                        {isEditingCityName ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={locationCityName}
                              onChange={(e) => setLocationCityName(e.target.value)}
                              placeholder="e.g. Surat, India"
                              className="h-8 rounded-lg border border-emerald-500/50 bg-neutral-900 px-2.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-emerald-400 w-full"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setIsEditingCityName(false)}
                              className="h-8 px-2.5 bg-emerald-500 text-neutral-950 font-bold text-xs rounded-lg shrink-0 hover:bg-emerald-400 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5">
                            <h3 className="text-base font-bold text-white truncate">
                              {locationCityName || 'Location Confirmed'}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setIsEditingCityName(true)}
                              className="text-neutral-400 hover:text-emerald-300 p-1 rounded hover:bg-emerald-500/10 transition-colors"
                              title="Edit City Display Name"
                            >
                              <IconPencil size={14} />
                            </button>
                          </div>
                        )}

                        <p className="text-[11px] text-emerald-500/90 font-mono mt-0.5">
                          Coordinates: {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                        </p>
                      </div>
                    </div>

                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                      ✓ Active
                    </span>
                  </div>
                </div>
              )}

              {/* Search any city / area */}
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <IconSearch size={14} className="text-rose-400" />
                    <span>Search City or Region</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 lowercase">worldwide</span>
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search any city (e.g. Surat, Mumbai, New York, London)..."
                    value={citySearchQuery}
                    onChange={(e) => handleCitySearch(e.target.value)}
                    className="h-11 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                  <IconSearch
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  />
                  {isSearchingCity && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                    </div>
                  )}

                  {/* Autocomplete dropdown suggestions */}
                  {citySearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl divide-y divide-neutral-800 max-h-64 overflow-y-auto">
                      {citySearchResults.map((res, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectCity(res)}
                          className="flex w-full items-center gap-3 p-3 text-left bg-neutral-900 hover:bg-neutral-800 transition-colors group"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 shrink-0 group-hover:bg-rose-500/20 transition-colors">
                            <IconMapPin size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              {res.name}
                            </span>
                            {res.region && (
                              <span className="text-[11px] text-neutral-400 block truncate">
                                {res.region}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </div>


              {/* Quick Popular Cities Fallback */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <IconWorld size={14} />
                    <span>Popular Cities</span>
                  </span>
                  <span className="text-[11px] text-neutral-500">quick select</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {POPULAR_CITIES.map((c) => {
                    const isSelected =
                      latitude !== null &&
                      Math.abs(latitude - c.lat) < 0.01 &&
                      longitude !== null &&
                      Math.abs(longitude - c.lng) < 0.01;

                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => selectCity(c)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-center truncate ${isSelected
                          ? 'bg-rose-500 text-white font-semibold shadow-sm shadow-rose-500/30'
                          : 'bg-neutral-950/80 border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900'
                          }`}
                        title={c.name}
                      >
                        {c.name.split(',')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Notice */}
              <p className="text-center text-[11px] text-neutral-500 flex items-center justify-center gap-1">
                <IconShieldCheck size={14} className="text-neutral-400" />
                We never reveal your exact street address. Only approximate distance.
              </p>
            </div>
          )}

          {/* STEP 4: Photos */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Add Your Best Photos</span>
                  <span className="text-xl">📸</span>
                </h1>
                <p className="mt-1 text-sm text-neutral-400">
                  Upload up to 6 photos. Your first photo is your main profile cover.
                </p>
              </div>

              {/* 6-Slot Photo Grid */}
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => {
                  const photo = photos[i];

                  if (photo) {
                    return (
                      <div
                        key={photo.preview}
                        onClick={() => setAsPrimaryPhoto(i)}
                        className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-rose-500 transition-all cursor-pointer shadow-lg"
                        title={i === 0 ? 'Primary Cover Photo' : 'Click to make Primary Cover'}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.preview}
                          alt={`Uploaded photo ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Primary Badge */}
                        {i === 0 ? (
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            <IconStar size={11} className="fill-current" />
                            <span>COVER</span>
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-semibold text-neutral-300">
                            Set as Cover
                          </div>
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => removePhoto(i, e)}
                          className="absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/90 hover:bg-rose-600 hover:text-white transition-all backdrop-blur-sm shadow-md"
                          title="Remove photo"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    );
                  }

                  // Empty Add Slot
                  return (
                    <label
                      key={`empty-${i}`}
                      className="aspect-[3/4] rounded-2xl border-2 border-dashed border-neutral-800 hover:border-rose-500/80 bg-neutral-950/50 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-neutral-900/60 group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 group-hover:bg-rose-500/20 text-neutral-500 group-hover:text-rose-400 transition-all">
                        <IconPlus size={20} />
                      </div>
                      <span className="mt-2 text-[11px] font-medium text-neutral-500 group-hover:text-neutral-300">
                        {i === 0 ? 'Add Cover' : `Photo ${i + 1}`}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  );
                })}
              </div>

              {/* Photo Tips Card */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3.5 text-xs text-neutral-400 flex items-start gap-2.5">
                <IconInfoCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-200">Tips for great matches:</span>
                  <p className="text-[11px] leading-relaxed text-neutral-400">
                    Use high quality solo shots with good lighting. Smile, show your hobbies, and avoid heavy sunglasses in your cover photo!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Live Profile Preview */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Profile Preview</span>
                  <span className="text-xl">✨</span>
                </h1>
                <p className="mt-1 text-sm text-neutral-400">
                  Here is how you’ll appear to potential matches in the Discover deck.
                </p>
              </div>

              {/* Interactive Dating Card Preview */}
              <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl relative">
                {/* Photo Area */}
                <div className="relative aspect-[3/4] w-full bg-neutral-900 overflow-hidden">
                  {photos.length > 0 ? (
                    <>
                      {/* Photo Bars */}
                      {photos.length > 1 && (
                        <div className="absolute top-3 inset-x-3 flex gap-1 z-20">
                          {photos.map((_, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewPhotoIndex(idx)}
                              className={`h-1 flex-1 rounded-full cursor-pointer transition-all ${idx === previewPhotoIndex ? 'bg-white shadow' : 'bg-white/30'
                                }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photos[previewPhotoIndex]?.preview || photos[0].preview}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />

                      {/* Left/Right Photo Tap Controls */}
                      {photos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotoIndex((prev) =>
                                prev > 0 ? prev - 1 : photos.length - 1,
                              )
                            }
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-md"
                          >
                            <IconChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotoIndex((prev) =>
                                prev < photos.length - 1 ? prev + 1 : 0,
                              )
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white backdrop-blur-md"
                          >
                            <IconChevronRight size={16} />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-neutral-600 gap-2">
                      <IconUser size={64} stroke={1.5} />
                      <span className="text-xs text-neutral-500">No photos uploaded yet</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent pointer-events-none" />

                  {/* Online Status Pill */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-emerald-400 backdrop-blur-md border border-white/10">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active Now</span>
                  </div>

                  {/* Card Details Overlay */}
                  <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight">{name || 'Your Name'}</h2>
                      {calculatedAge && (
                        <span className="text-2xl font-light text-neutral-300">
                          {calculatedAge}
                        </span>
                      )}
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white text-[10px]">
                        ✓
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-neutral-300 mt-1">
                      <IconMapPin size={13} className="text-rose-400" />
                      <span>{locationCityName ? `${locationCityName} • Nearby` : 'Nearby'}</span>
                    </div>

                    {/* Bio */}
                    {bio && (
                      <p className="mt-2.5 text-xs text-neutral-200/90 leading-relaxed line-clamp-2">
                        {bio}
                      </p>
                    )}

                    {/* Intent & Passions Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {/* Intent Pill */}
                      {selectedIntent && (
                        <span className="rounded-full bg-rose-500/30 text-rose-200 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md border border-rose-500/40">
                          {selectedIntent === 'other'
                            ? `🎯 ${customIntentText || 'Custom Goal'}`
                            : RELATIONSHIP_INTENTS.find((i) => i.value === selectedIntent)?.label || selectedIntent}
                        </span>
                      )}

                      {/* Passions */}
                      {selectedPassions.slice(0, 5).map((tagId) => {
                        const tag = PASSION_TAGS.find((p) => p.id === tagId);
                        return (
                          <span
                            key={tagId}
                            className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-md text-white border border-white/20"
                          >
                            {tag ? tag.label : `✨ ${tagId}`}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-center text-xs font-medium text-red-300 animate-in fade-in">
              {error}
            </div>
          )}

          {/* Footer Navigation Buttons */}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep((s) => s - 1);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950/80 px-5 py-3 text-sm font-semibold text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900 transition-all active:scale-[0.98]"
              >
                <IconChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                disabled={!canProceedFromStep(step)}
                onClick={() => {
                  setError('');
                  setStep((s) => s + 1);
                }}
                className="group relative flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <span>Continue</span>
                <IconChevronRight size={16} />
              </button>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => finishSetup(false)}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 py-3.5 text-base font-bold text-white shadow-xl shadow-rose-600/30 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Creating profile...</span>
                    </div>
                  ) : (
                    <>
                      <span>Looks Great! Start Matching</span>
                      <IconFlame size={18} className="animate-bounce" />
                    </>
                  )}
                </button>

                {photos.length === 0 && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => finishSetup(true)}
                    className="w-full text-center text-xs text-neutral-400 hover:text-neutral-200 py-1 transition-colors"
                  >
                    Skip photos for now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
