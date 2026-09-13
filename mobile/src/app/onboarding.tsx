import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, needsOnboarding } from '@/context/AuthContext';
import { mobileApi } from '@/services/api';

const GENDERS = [
  { value: 'male', label: 'Male', icon: 'man' as const },
  { value: 'female', label: 'Female', icon: 'woman' as const },
  { value: 'other', label: 'Other', icon: 'person' as const },
];

const INTEREST_OPTIONS = [
  { value: 'male', label: 'Men', emoji: '👨' },
  { value: 'female', label: 'Women', emoji: '👩' },
  { value: 'other', label: 'Everyone', emoji: '🌈' },
];

const RELATIONSHIP_INTENTS = [
  { value: 'long-term', label: 'Long-term relationship', emoji: '💞' },
  { value: 'dating', label: 'Dating & seeing where it goes', emoji: '🥂' },
  { value: 'casual', label: 'Casual & fun', emoji: '✨' },
  { value: 'friends', label: 'New friends', emoji: '🤝' },
  { value: 'other', label: 'Other (Custom)', emoji: '✏️' },
];

const POPULAR_PASSIONS = [
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'fitness', label: '🏋️ Fitness' },
  { id: 'music', label: '🎧 Music' },
  { id: 'foodie', label: '🍕 Foodie' },
  { id: 'movies', label: '🎬 Movies' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'art', label: '🎨 Art' },
  { id: 'pets', label: '🐶 Pets' },
  { id: 'tech', label: '💻 Tech' },
  { id: 'outdoor', label: '🧗 Outdoor' },
  { id: 'reading', label: '📚 Reading' },
  { id: 'photography', label: '📸 Photography' },
  { id: 'cooking', label: '🍳 Cooking' },
];

const PROMPT_STARTERS = [
  'A fun fact about me...',
  'My ideal Sunday looks like...',
  'Looking for someone who...',
  'Never have I ever...',
  'The way to win me over is...',
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

const CURATED_SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop',
];

type PhotoItem = { uri: string };

export default function SetupPage() {
  const router = useRouter();
  const { user, refreshUser, completeOnboarding } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Step 1: Basics
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [gender, setGender] = useState('');

  // Step 2: Vibe & Lifestyle
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<string>('dating');
  const [customIntentText, setCustomIntentText] = useState<string>('');
  const [selectedPassions, setSelectedPassions] = useState<string[]>([]);
  const [customPassionInput, setCustomPassionInput] = useState<string>('');
  const [isAddingCustomPassion, setIsAddingCustomPassion] = useState<boolean>(false);
  const [bio, setBio] = useState('');

  // Step 3: Location
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<
    { name: string; region?: string; fullName: string; lat: number; lng: number }[]
  >([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  // Step 4: Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoActionVisible, setPhotoActionVisible] = useState(false);

  // Load existing profile info if available
  useEffect(() => {
    refreshUser().then((currentUser) => {
      if (currentUser && !needsOnboarding(currentUser)) {
        router.replace('/');
        return;
      }
      if (currentUser) {
        const profile = currentUser.profile;
        if (profile?.name || currentUser.name) {
          setName(profile?.name || currentUser.name || '');
        }
        if (profile?.gender || currentUser.gender) {
          setGender(profile?.gender || currentUser.gender || '');
        }
        if (profile?.interestedIn || currentUser.interestedIn) {
          const interests = profile?.interestedIn || currentUser.interestedIn;
          if (Array.isArray(interests)) setInterestedIn(interests);
        }
        if (profile?.latitude ?? currentUser.latitude) {
          setLatitude(profile?.latitude ?? currentUser.latitude ?? null);
        }
        if (profile?.longitude ?? currentUser.longitude) {
          setLongitude(profile?.longitude ?? currentUser.longitude ?? null);
        }
        if (profile?.dob || currentUser.dob) {
          const dobStr = profile?.dob || currentUser.dob || '';
          try {
            const d = new Date(dobStr);
            if (!isNaN(d.getTime())) {
              setYear(d.getFullYear().toString());
              setMonth((d.getMonth() + 1).toString().padStart(2, '0'));
              setDay(d.getDate().toString().padStart(2, '0'));
            }
          } catch {}
        }
      }
      setChecking(false);
    });
  }, []);

  // Compute ISO DOB & Age
  const formattedDob = useMemo(() => {
    if (!year || !month || !day) return '';
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
    if (y < 1900 || y > new Date().getFullYear()) return '';
    if (m < 1 || m > 12) return '';
    if (d < 1 || d > 31) return '';
    return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  }, [year, month, day]);

  const calculatedAge = useMemo(() => {
    if (!formattedDob) return null;
    const birthDate = new Date(formattedDob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [formattedDob]);

  const isAgeValid = calculatedAge !== null && calculatedAge >= 18 && calculatedAge <= 110;

  // Toggle helpers
  function toggleInterest(value: string) {
    setError('');
    setInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function togglePassion(id: string) {
    setSelectedPassions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleAddCustomPassion() {
    const trimmed = customPassionInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!selectedPassions.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedPassions((prev) => [...prev, trimmed]);
    }
    setCustomPassionInput('');
    setIsAddingCustomPassion(false);
  }

  function appendPrompt(promptText: string) {
    if (bio.includes(promptText)) return;
    setBio((prev) => (prev ? `${prev}\n\n${promptText} ` : `${promptText} `));
  }

  // Location helpers
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
    } catch {}

    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.state;
        const country = addr.country;
        if (city) {
          return country ? `${city}, ${country}` : city;
        }
      }
    } catch {}

    return 'Detected Location';
  }

  function requestLocation() {
    setError('');
    setLocatingGps(true);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLatitude(lat);
          setLongitude(lng);
          try {
            const nameResolved = await fetchCityNameFromCoords(lat, lng);
            setLocationName(nameResolved);
          } catch {
            setLocationName('GPS Location');
          } finally {
            setLocatingGps(false);
          }
        },
        () => {
          setLatitude(21.1702);
          setLongitude(72.8311);
          setLocationName('Surat, India');
          setLocatingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLatitude(21.1702);
      setLongitude(72.8311);
      setLocationName('Surat, India');
      setLocatingGps(false);
    }
  }

  async function handleCitySearch(query: string) {
    setCitySearchQuery(query);
    if (!query.trim() || query.trim().length < 2) {
      setCitySearchResults([]);
      return;
    }

    setIsSearchingCity(true);
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=6`
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

      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query.trim()
        )}&limit=5&addressdetails=1`
      );
      if (osmRes.ok) {
        const data = await osmRes.json();
        if (data && data.length > 0) {
          const formatted = data.map((item: any) => {
            const addr = item.address || {};
            const mainName =
              addr.city || addr.town || addr.village || addr.suburb || item.name || item.display_name.split(',')[0];
            const regionParts = [addr.state, addr.country].filter(Boolean);
            return {
              name: mainName,
              region: regionParts.join(', '),
              fullName: [mainName, ...regionParts].filter(Boolean).join(', '),
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          setCitySearchResults(formatted);
          return;
        }
      }
    } catch (e) {
      console.warn('City search warning:', e);
    } finally {
      setIsSearchingCity(false);
    }
  }

  function selectCity(city: { name: string; fullName?: string; lat: number; lng: number }) {
    setLatitude(city.lat);
    setLongitude(city.lng);
    setLocationName(city.fullName || city.name);
    setCitySearchQuery('');
    setCitySearchResults([]);
    setError('');
  }

  // Photo helpers
  async function pickImageFromGallery() {
    setPhotoPickerVisible(false);
    if (photos.length >= 6) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission needed', 'Please allow gallery access to upload your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPhotos((prev) => [
          ...prev,
          { uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined },
        ]);
      }
    } catch (e) {
      console.warn('Gallery pick fallback:', e);
    }
  }

  async function takePhotoWithCamera() {
    setPhotoPickerVisible(false);
    if (photos.length >= 6) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setPhotos((prev) => [
          ...prev,
          { uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined },
        ]);
      }
    } catch (e) {
      console.warn('Camera take fallback:', e);
    }
  }

  function selectSamplePhoto(uri: string) {
    setPhotoPickerVisible(false);
    if (photos.length >= 6) return;
    setPhotos((prev) => [...prev, { uri }]);
  }

  function setAsCoverPhoto(index: number) {
    setPhotoActionVisible(false);
    if (index === 0 || index >= photos.length) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const [chosen] = copy.splice(index, 1);
      copy.unshift(chosen);
      return copy;
    });
  }

  function removePhoto(index: number) {
    setPhotoActionVisible(false);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // Construct bio with metadata tags
  function buildFormattedBio() {
    let result = bio.trim();
    if (selectedPassions.length > 0) {
      result = `[INTERESTS:${selectedPassions.join(',')}] ${result}`;
    }
    if (locationName) {
      result = `[CITY:${locationName}] ${result}`;
    }
    if (selectedIntent) {
      const intentLabel =
        selectedIntent === 'other'
          ? customIntentText || 'Custom'
          : RELATIONSHIP_INTENTS.find((i) => i.value === selectedIntent)?.label || selectedIntent;
      result = `[INTENT:${intentLabel}] ${result}`;
    }
    return result;
  }

  // Step Validation Check
  function canProceed(stepNum: number) {
    if (stepNum === 1) {
      return Boolean(name.trim() && formattedDob && isAgeValid && gender);
    }
    if (stepNum === 2) {
      return interestedIn.length > 0;
    }
    if (stepNum === 3) {
      return latitude != null && longitude != null;
    }
    return true;
  }

  // Submit onboarding
  async function finishSetup(skipPhotos = false) {
    if (!name.trim() || !formattedDob || !gender || interestedIn.length === 0) {
      setError('Please complete all required fields.');
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
      const photoUrls = photos.map((p) => p.uri);

      await completeOnboarding({
        name: name.trim(),
        dob: formattedDob,
        gender,
        bio: fullBio || undefined,
        interestedIn,
        latitude,
        longitude,
        photos: photoUrls,
      });

      if (!skipPhotos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          try {
            await mobileApi.uploadPhoto(photos[i].uri, i, (photos[i] as any).base64);
          } catch (uploadErr) {
            console.warn(`Photo ${i} upload warning:`, uploadErr);
          }
        }
      }

      await refreshUser();
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Something went wrong while saving your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text style={styles.checkingText}>Loading profile setup...</Text>
      </SafeAreaView>
    );
  }

  const stepsList = [
    { num: 1, title: 'Basics', icon: 'person' as const },
    { num: 2, title: 'Vibe', icon: 'sparkles' as const },
    { num: 3, title: 'Location', icon: 'location' as const },
    { num: 4, title: 'Photos', icon: 'camera' as const },
    { num: 5, title: 'Preview', icon: 'heart' as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardWrapper}>
            {/* Top Brand Header */}
            <View style={styles.brandRow}>
              <View style={styles.brandLogoBox}>
                <Ionicons name="flame" size={20} color="#f43f5e" />
                <Text style={styles.brandLogoText}>Ember</Text>
              </View>
              <View style={styles.stepBadgeBox}>
                <Text style={styles.stepBadgeText}>
                  Step <Text style={{ color: '#f43f5e', fontWeight: '700' }}>{step}</Text> of 5
                </Text>
              </View>
            </View>

            {/* Stepper Progress Indicator */}
            <View style={styles.stepperContainer}>
              <View style={styles.stepperLineBackground} />
              <View
                style={[
                  styles.stepperLineActive,
                  { width: `${((step - 1) / (stepsList.length - 1)) * 100}%` },
                ]}
              />

              {stepsList.map((s) => {
                const isPast = step > s.num;
                const isCurrent = step === s.num;

                return (
                  <TouchableOpacity
                    key={s.num}
                    style={styles.stepNode}
                    disabled={!isPast}
                    onPress={() => {
                      if (isPast) {
                        setError('');
                        setStep(s.num);
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.stepCircle,
                        isPast && styles.stepCirclePast,
                        isCurrent && styles.stepCircleCurrent,
                      ]}
                    >
                      {isPast ? (
                        <Ionicons name="checkmark" size={14} color="#f43f5e" />
                      ) : (
                        <Ionicons
                          name={s.icon}
                          size={14}
                          color={isCurrent ? '#ffffff' : '#71717a'}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepNodeLabel,
                        isCurrent && styles.stepNodeLabelCurrent,
                        isPast && styles.stepNodeLabelPast,
                      ]}
                    >
                      {s.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Main Form Box */}
            <View style={styles.cardBody}>
              {/* STEP 1: BASICS */}
              {step === 1 && (
                <View style={styles.sectionGap}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.sectionTitle}>Tell us about you ✨</Text>
                    <Text style={styles.sectionSubtitle}>
                      Let's start with the basics so matches know who you are.
                    </Text>
                  </View>

                  {/* Full Name */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>FULL NAME</Text>
                      <Text style={styles.labelHint}>shown on profile</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Alex Sharma"
                      placeholderTextColor="#71717a"
                      maxLength={30}
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (error) setError('');
                      }}
                    />
                  </View>

                  {/* Date of Birth */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>DATE OF BIRTH</Text>
                      {calculatedAge !== null && (
                        <View
                          style={[
                            styles.ageTag,
                            isAgeValid ? styles.ageTagValid : styles.ageTagInvalid,
                          ]}
                        >
                          <Text
                            style={[
                              styles.ageTagText,
                              isAgeValid ? styles.ageTagTextValid : styles.ageTagTextInvalid,
                            ]}
                          >
                            {isAgeValid ? `🎉 ${calculatedAge} years old` : 'Must be 18+'}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.dobRow}>
                      <View style={[styles.dobFieldBox, { flex: 1 }]}>
                        <Text style={styles.dobFieldLabel}>Day (DD)</Text>
                        <TextInput
                          style={styles.dobInput}
                          placeholder="DD"
                          placeholderTextColor="#52525b"
                          keyboardType="number-pad"
                          maxLength={2}
                          value={day}
                          onChangeText={(val) => {
                            setDay(val);
                            if (error) setError('');
                          }}
                        />
                      </View>
                      <View style={[styles.dobFieldBox, { flex: 1 }]}>
                        <Text style={styles.dobFieldLabel}>Month (MM)</Text>
                        <TextInput
                          style={styles.dobInput}
                          placeholder="MM"
                          placeholderTextColor="#52525b"
                          keyboardType="number-pad"
                          maxLength={2}
                          value={month}
                          onChangeText={(val) => {
                            setMonth(val);
                            if (error) setError('');
                          }}
                        />
                      </View>
                      <View style={[styles.dobFieldBox, { flex: 1.4 }]}>
                        <Text style={styles.dobFieldLabel}>Year (YYYY)</Text>
                        <TextInput
                          style={styles.dobInput}
                          placeholder="YYYY"
                          placeholderTextColor="#52525b"
                          keyboardType="number-pad"
                          maxLength={4}
                          value={year}
                          onChangeText={(val) => {
                            setYear(val);
                            if (error) setError('');
                          }}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Gender Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>I AM A</Text>
                    <View style={styles.genderGrid}>
                      {GENDERS.map((g) => {
                        const isSelected = gender === g.value;
                        return (
                          <TouchableOpacity
                            key={g.value}
                            style={[styles.genderCard, isSelected && styles.genderCardActive]}
                            onPress={() => {
                              setGender(g.value);
                              if (error) setError('');
                            }}
                          >
                            <Ionicons
                              name={g.icon}
                              size={20}
                              color={isSelected ? '#f43f5e' : '#a1a1aa'}
                            />
                            <Text
                              style={[
                                styles.genderCardText,
                                isSelected && styles.genderCardTextActive,
                              ]}
                            >
                              {g.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 2: VIBE & PREFERENCES */}
              {step === 2 && (
                <View style={styles.sectionGap}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.sectionTitle}>Your Vibe & Preferences 💫</Text>
                    <Text style={styles.sectionSubtitle}>
                      Set who you want to discover and pick things you love.
                    </Text>
                  </View>

                  {/* Interested In */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>SHOW ME</Text>
                      <Text style={styles.labelHint}>select all that apply</Text>
                    </View>
                    <View style={styles.interestGrid}>
                      {INTEREST_OPTIONS.map((opt) => {
                        const isSelected = interestedIn.includes(opt.value);
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.interestButton,
                              isSelected && styles.interestButtonActive,
                            ]}
                            onPress={() => toggleInterest(opt.value)}
                          >
                            <Text style={styles.interestEmoji}>{opt.emoji}</Text>
                            <Text
                              style={[
                                styles.interestButtonText,
                                isSelected && styles.interestButtonTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#f43f5e"
                                style={{ marginLeft: 4 }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Relationship Intent */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>LOOKING FOR</Text>
                    <View style={styles.intentList}>
                      {RELATIONSHIP_INTENTS.map((intent) => {
                        const isSelected = selectedIntent === intent.value;
                        return (
                          <TouchableOpacity
                            key={intent.value}
                            style={[styles.intentCard, isSelected && styles.intentCardActive]}
                            onPress={() => setSelectedIntent(intent.value)}
                          >
                            <Text style={styles.intentEmoji}>{intent.emoji}</Text>
                            <Text
                              style={[
                                styles.intentLabel,
                                isSelected && styles.intentLabelActive,
                              ]}
                            >
                              {intent.label}
                            </Text>
                            {isSelected && (
                              <Ionicons name="radio-button-on" size={18} color="#f43f5e" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {selectedIntent === 'other' && (
                      <TextInput
                        style={[styles.textInput, { marginTop: 8 }]}
                        placeholder="Specify what you're looking for..."
                        placeholderTextColor="#71717a"
                        value={customIntentText}
                        onChangeText={setCustomIntentText}
                        maxLength={40}
                      />
                    )}
                  </View>

                  {/* Passions & Lifestyle */}
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>PASSIONS & LIFESTYLE</Text>
                      <Text style={styles.labelHint}>{selectedPassions.length} chosen</Text>
                    </View>

                    <View style={styles.passionsFlex}>
                      {POPULAR_PASSIONS.map((tag) => {
                        const isSelected = selectedPassions.includes(tag.id);
                        return (
                          <TouchableOpacity
                            key={tag.id}
                            style={[styles.passionTag, isSelected && styles.passionTagActive]}
                            onPress={() => togglePassion(tag.id)}
                          >
                            <Text
                              style={[
                                styles.passionTagText,
                                isSelected && styles.passionTagTextActive,
                              ]}
                            >
                              {tag.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {/* Render custom passions */}
                      {selectedPassions
                        .filter((p) => !POPULAR_PASSIONS.some((pp) => pp.id === p))
                        .map((cp) => (
                          <TouchableOpacity
                            key={cp}
                            style={[styles.passionTag, styles.passionTagActive]}
                            onPress={() => togglePassion(cp)}
                          >
                            <Text style={[styles.passionTagText, styles.passionTagTextActive]}>
                              ✨ {cp}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>

                    {isAddingCustomPassion ? (
                      <View style={styles.addCustomPassionRow}>
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          placeholder="e.g. Anime, Stargazing..."
                          placeholderTextColor="#71717a"
                          value={customPassionInput}
                          onChangeText={setCustomPassionInput}
                          autoFocus
                          maxLength={25}
                        />
                        <TouchableOpacity
                          style={styles.addCustomBtn}
                          onPress={handleAddCustomPassion}
                        >
                          <Ionicons name="add" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelCustomBtn}
                          onPress={() => setIsAddingCustomPassion(false)}
                        >
                          <Ionicons name="close" size={20} color="#a1a1aa" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addCustomTagLink}
                        onPress={() => setIsAddingCustomPassion(true)}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#f43f5e" />
                        <Text style={styles.addCustomTagLinkText}>Add custom passion</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Bio & Prompts */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>BIO (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Write a few lines about yourself, your vibe, or what excites you..."
                      placeholderTextColor="#71717a"
                      multiline
                      value={bio}
                      onChangeText={setBio}
                    />

                    {/* Quick prompt starters */}
                    <Text style={[styles.labelHint, { marginTop: 8, marginBottom: 4 }]}>
                      Tap a prompt to add to bio:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.promptsRow}>
                        {PROMPT_STARTERS.map((prompt, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.promptChip}
                            onPress={() => appendPrompt(prompt)}
                          >
                            <Text style={styles.promptChipText}>{prompt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* STEP 3: LOCATION */}
              {step === 3 && (
                <View style={styles.sectionGap}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.sectionTitle}>Set your location 📍</Text>
                    <Text style={styles.sectionSubtitle}>
                      We use this to connect you with awesome people nearby.
                    </Text>
                  </View>

                  {/* GPS Button */}
                  <TouchableOpacity
                    style={[styles.gpsActionBtn, locatingGps && styles.btnDisabled]}
                    onPress={requestLocation}
                    disabled={locatingGps}
                  >
                    {locatingGps ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="navigate" size={18} color="#ffffff" />
                        <Text style={styles.gpsActionBtnText}>Use my current GPS location</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Selected Location Card */}
                  {latitude != null && longitude != null && (
                    <View style={styles.selectedLocationCard}>
                      <Ionicons name="location" size={24} color="#4ade80" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.locationCityTitle}>
                          {locationName || 'GPS Location Detected'}
                        </Text>
                        <Text style={styles.locationCoordsText}>
                          {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
                    </View>
                  )}

                  {/* Global City Search */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>SEARCH CITY OR TOWN</Text>
                    <View style={styles.searchBarBox}>
                      <Ionicons name="search" size={18} color="#71717a" />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search any city (e.g. Surat, London, NYC)..."
                        placeholderTextColor="#71717a"
                        value={citySearchQuery}
                        onChangeText={handleCitySearch}
                      />
                      {isSearchingCity && (
                        <ActivityIndicator size="small" color="#f43f5e" style={{ marginLeft: 8 }} />
                      )}
                    </View>

                    {/* Search Results Dropdown */}
                    {citySearchResults.length > 0 && (
                      <View style={styles.searchResultsBox}>
                        {citySearchResults.map((city, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.searchResultItem}
                            onPress={() => selectCity(city)}
                          >
                            <Ionicons name="business-outline" size={16} color="#f43f5e" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.searchResultName}>{city.name}</Text>
                              {city.region ? (
                                <Text style={styles.searchResultRegion}>{city.region}</Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Popular City Shortcuts */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>OR PICK A POPULAR CITY</Text>
                    <View style={styles.popularCitiesGrid}>
                      {POPULAR_CITIES.map((c) => {
                        const isChosen =
                          latitude != null &&
                          Math.abs(latitude - c.lat) < 0.1 &&
                          Math.abs(longitude! - c.lng) < 0.1;
                        return (
                          <TouchableOpacity
                            key={c.name}
                            style={[
                              styles.cityShortcutBtn,
                              isChosen && styles.cityShortcutBtnActive,
                            ]}
                            onPress={() => selectCity(c)}
                          >
                            <Text
                              style={[
                                styles.cityShortcutBtnText,
                                isChosen && styles.cityShortcutBtnTextActive,
                              ]}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 4: PHOTOS */}
              {step === 4 && (
                <View style={styles.sectionGap}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.sectionTitle}>Add your photos 📸</Text>
                    <Text style={styles.sectionSubtitle}>
                      Profiles with high quality photos get 5x more matches.
                    </Text>
                  </View>

                  <View style={styles.photosGridContainer}>
                    {photos.map((photo, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.photoCardSlot}
                        activeOpacity={0.8}
                        onPress={() => {
                          setSelectedPhotoIndex(i);
                          setPhotoActionVisible(true);
                        }}
                      >
                        <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                        {i === 0 && (
                          <View style={styles.coverPhotoBadge}>
                            <Text style={styles.coverPhotoBadgeText}>COVER</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.photoQuickDelete}
                          onPress={() => removePhoto(i)}
                        >
                          <Ionicons name="close" size={14} color="#ffffff" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}

                    {photos.length < 6 && (
                      <TouchableOpacity
                        style={styles.addPhotoSlot}
                        onPress={() => setPhotoPickerVisible(true)}
                      >
                        <Ionicons name="add" size={28} color="#f43f5e" />
                        <Text style={styles.addPhotoSlotText}>Add Photo</Text>
                        <Text style={styles.addPhotoSlotSub}>{photos.length}/6 slots</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* STEP 5: PREVIEW & CONFIRM */}
              {step === 5 && (
                <View style={styles.sectionGap}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.sectionTitle}>Preview your profile 🔥</Text>
                    <Text style={styles.sectionSubtitle}>
                      This is how your profile will look to others on Ember.
                    </Text>
                  </View>

                  {/* Profile Card Mock */}
                  <View style={styles.previewCard}>
                    {photos.length > 0 ? (
                      <Image
                        source={{ uri: photos[0].uri }}
                        style={styles.previewCardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.previewCardPlaceholder}>
                        <Ionicons name="person-circle" size={80} color="#52525b" />
                        <Text style={styles.previewPlaceholderText}>No photo added</Text>
                      </View>
                    )}

                    <View style={styles.previewCardOverlay}>
                      <View style={styles.previewHeaderRow}>
                        <Text style={styles.previewName}>
                          {name || 'Alex'}, {calculatedAge || 24}
                        </Text>
                        <View style={styles.verifiedIconBadge}>
                          <Ionicons name="shield-checkmark" size={16} color="#38bdf8" />
                        </View>
                      </View>

                      {locationName ? (
                        <View style={styles.previewInfoRow}>
                          <Ionicons name="location-sharp" size={14} color="#f43f5e" />
                          <Text style={styles.previewLocationText}>{locationName}</Text>
                        </View>
                      ) : null}

                      {selectedIntent && (
                        <View style={styles.previewIntentBadge}>
                          <Text style={styles.previewIntentText}>
                            {RELATIONSHIP_INTENTS.find((i) => i.value === selectedIntent)?.emoji ||
                              '✨'}{' '}
                            {selectedIntent === 'other'
                              ? customIntentText || 'Custom'
                              : RELATIONSHIP_INTENTS.find((i) => i.value === selectedIntent)
                                  ?.label || selectedIntent}
                          </Text>
                        </View>
                      )}

                      {selectedPassions.length > 0 && (
                        <View style={styles.previewPassionsRow}>
                          {selectedPassions.slice(0, 4).map((p) => (
                            <View key={p} style={styles.previewPassionChip}>
                              <Text style={styles.previewPassionText}>#{p}</Text>
                            </View>
                          ))}
                          {selectedPassions.length > 4 && (
                            <View style={styles.previewPassionChip}>
                              <Text style={styles.previewPassionText}>
                                +{selectedPassions.length - 4} more
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {bio.trim() ? (
                        <Text style={styles.previewBioText} numberOfLines={3}>
                          {bio.trim()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}

              {/* Error Box */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#f87171" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Bottom Navigation Buttons */}
              <View style={styles.navRow}>
                {step > 1 && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      setError('');
                      setStep((s) => s - 1);
                    }}
                  >
                    <Ionicons name="arrow-back" size={18} color="#ffffff" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                {step < 5 ? (
                  <TouchableOpacity
                    style={[
                      styles.continueButton,
                      styles.flex1,
                      !canProceed(step) && styles.btnDisabled,
                    ]}
                    disabled={!canProceed(step)}
                    onPress={() => {
                      setError('');
                      setStep((s) => s + 1);
                    }}
                  >
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.flex1}>
                    <TouchableOpacity
                      style={[styles.finishButton, loading && styles.btnDisabled]}
                      disabled={loading}
                      onPress={() => finishSetup(false)}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="flame" size={20} color="#ffffff" />
                          <Text style={styles.finishButtonText}>Finish & start swiping</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {photos.length === 0 && (
                      <TouchableOpacity
                        disabled={loading}
                        onPress={() => finishSetup(true)}
                        style={styles.skipPhotosLink}
                      >
                        <Text style={styles.skipPhotosText}>Skip photos for now</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photo Picker Modal */}
      <Modal visible={photoPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Profile Photo</Text>
              <TouchableOpacity onPress={() => setPhotoPickerVisible(false)}>
                <Ionicons name="close" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={pickImageFromGallery}>
              <Ionicons name="images" size={20} color="#f43f5e" />
              <Text style={styles.modalOptionText}>Choose from Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={takePhotoWithCamera}>
              <Ionicons name="camera" size={20} color="#f43f5e" />
              <Text style={styles.modalOptionText}>Take Photo with Camera</Text>
            </TouchableOpacity>

            <View style={styles.modalDivider}>
              <Text style={styles.modalDividerText}>OR CHOOSE A CURATED SAMPLE</Text>
            </View>

            <View style={styles.samplePhotosGrid}>
              {CURATED_SAMPLE_PHOTOS.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.samplePhotoItem}
                  onPress={() => selectSamplePhoto(uri)}
                >
                  <Image source={{ uri }} style={styles.samplePhotoImage} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Action (Cover / Delete) Modal */}
      <Modal visible={photoActionVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Photo Options</Text>
              <TouchableOpacity onPress={() => setPhotoActionVisible(false)}>
                <Ionicons name="close" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            {selectedPhotoIndex !== null && selectedPhotoIndex > 0 && (
              <TouchableOpacity
                style={styles.modalOptionBtn}
                onPress={() => setAsCoverPhoto(selectedPhotoIndex)}
              >
                <Ionicons name="star" size={20} color="#f59e0b" />
                <Text style={styles.modalOptionText}>Set as Cover Photo</Text>
              </TouchableOpacity>
            )}

            {selectedPhotoIndex !== null && (
              <TouchableOpacity
                style={[styles.modalOptionBtn, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                onPress={() => removePhoto(selectedPhotoIndex)}
              >
                <Ionicons name="trash" size={20} color="#ef4444" />
                <Text style={[styles.modalOptionText, { color: '#ef4444' }]}>Delete Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkingText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 480,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandLogoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandLogoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  stepBadgeBox: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  stepBadgeText: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  stepperLineBackground: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 14,
    height: 2,
    backgroundColor: '#27272a',
    zIndex: 0,
  },
  stepperLineActive: {
    position: 'absolute',
    left: 20,
    top: 14,
    height: 2,
    backgroundColor: '#f43f5e',
    zIndex: 1,
  },
  stepNode: {
    alignItems: 'center',
    zIndex: 2,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCirclePast: {
    borderColor: 'rgba(244, 63, 94, 0.6)',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  stepCircleCurrent: {
    borderColor: '#f43f5e',
    backgroundColor: '#f43f5e',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  stepNodeLabel: {
    fontSize: 10,
    color: '#71717a',
    fontWeight: '600',
    marginTop: 4,
  },
  stepNodeLabelCurrent: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stepNodeLabelPast: {
    color: '#d4d4d8',
  },
  cardBody: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  sectionGap: {
    gap: 18,
    marginBottom: 20,
  },
  titleBlock: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    letterSpacing: 0.5,
  },
  labelHint: {
    fontSize: 11,
    color: '#71717a',
  },
  textInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#ffffff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dobRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dobFieldBox: {
    gap: 4,
  },
  dobFieldLabel: {
    fontSize: 10,
    color: '#71717a',
  },
  dobInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  ageTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  ageTagValid: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  ageTagInvalid: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  ageTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ageTagTextValid: {
    color: '#4ade80',
  },
  ageTagTextInvalid: {
    color: '#f87171',
  },
  genderGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  genderCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 12,
  },
  genderCardActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  genderCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  genderCardTextActive: {
    color: '#f43f5e',
    fontWeight: '700',
  },
  interestGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  interestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 12,
  },
  interestButtonActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  interestEmoji: {
    fontSize: 15,
  },
  interestButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  interestButtonTextActive: {
    color: '#f43f5e',
    fontWeight: '700',
  },
  intentList: {
    gap: 6,
  },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  intentCardActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  intentEmoji: {
    fontSize: 16,
  },
  intentLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#d4d4d8',
  },
  intentLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  passionsFlex: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  passionTag: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  passionTagActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  passionTagText: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  passionTagTextActive: {
    color: '#f43f5e',
    fontWeight: '700',
  },
  addCustomTagLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  addCustomTagLinkText: {
    fontSize: 12,
    color: '#f43f5e',
    fontWeight: '600',
  },
  addCustomPassionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addCustomBtn: {
    backgroundColor: '#f43f5e',
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCustomBtn: {
    backgroundColor: '#27272a',
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  promptChip: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  promptChipText: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  gpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 14,
  },
  gpsActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  locationCityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  locationCoordsText: {
    fontSize: 11,
    color: '#4ade80',
    marginTop: 2,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  searchResultsBox: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  searchResultRegion: {
    fontSize: 11,
    color: '#71717a',
  },
  popularCitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cityShortcutBtn: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cityShortcutBtnActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  cityShortcutBtnText: {
    fontSize: 12,
    color: '#d4d4d8',
  },
  cityShortcutBtnTextActive: {
    color: '#f43f5e',
    fontWeight: '700',
  },
  photosGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCardSlot: {
    width: '30.5%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#09090b',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  coverPhotoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#f43f5e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverPhotoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  photoQuickDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoSlot: {
    width: '30.5%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
    gap: 2,
  },
  addPhotoSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  addPhotoSlotSub: {
    fontSize: 9,
    color: '#71717a',
  },
  previewCard: {
    backgroundColor: '#09090b',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
    position: 'relative',
  },
  previewCardImage: {
    width: '100%',
    height: 320,
  },
  previewCardPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
  },
  previewPlaceholderText: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 6,
  },
  previewCardOverlay: {
    padding: 16,
    gap: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  verifiedIconBadge: {
    marginLeft: 2,
  },
  previewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewLocationText: {
    fontSize: 12,
    color: '#d4d4d8',
    fontWeight: '500',
  },
  previewIntentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewIntentText: {
    fontSize: 11,
    color: '#f43f5e',
    fontWeight: '700',
  },
  previewPassionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewPassionChip: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewPassionText: {
    fontSize: 11,
    color: '#d4d4d8',
  },
  previewBioText: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#f87171',
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  flex1: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 14,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 14,
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  skipPhotosLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  skipPhotosText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalDivider: {
    alignItems: 'center',
    marginVertical: 4,
  },
  modalDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
  },
  samplePhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  samplePhotoItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  samplePhotoImage: {
    width: '100%',
    height: '100%',
  },
});
