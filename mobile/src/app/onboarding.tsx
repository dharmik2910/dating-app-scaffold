import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, needsOnboarding } from '@/context/AuthContext';
import { mobileApi } from '@/services/api';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];


const INTERESTS = [
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'other', label: 'Everyone' },
];


const PASSION_TAGS = [
  { id: 'coffee', label: '☕ Coffee' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'fitness', label: '🏋️ Fitness' },
  { id: 'music', label: '🎧 Music' },
  { id: 'foodie', label: '🍕 Foodie' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'art', label: '🎨 Art' },
  { id: 'pets', label: '🐶 Pets' },
  { id: 'tech', label: '💻 Tech' },
  { id: 'hiking', label: '🧗 Outdoor' },
];

const POPULAR_CITIES = [
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
];

type PhotoItem = { uri: string };

export default function SetupPage() {
  const router = useRouter();
  const { user, refreshUser, completeOnboarding } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [selectedPassions, setSelectedPassions] = useState<string[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  useEffect(() => {
    refreshUser().then((currentUser) => {
      if (currentUser && !needsOnboarding(currentUser)) {
        router.replace('/');
        return;
      }
      setChecking(false);
    });
  }, []);

  function toggleInterest(value: string) {
    setInterestedIn((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function togglePassion(id: string) {
    setSelectedPassions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function selectCity(city: (typeof POPULAR_CITIES)[0]) {
    setLatitude(city.lat);
    setLongitude(city.lng);
    setLocationName(city.name);
    setError('');
  }

  function handlePhotoAdd() {
    const samplePhotos = [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop',
    ];
    if (photos.length < 6) {
      const nextUri = samplePhotos[photos.length % samplePhotos.length];
      setPhotos((prev) => [...prev, { uri: nextUri }]);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function requestLocation() {
    setError('');
    setLoading(true);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLatitude(lat);
          setLongitude(lng);
          try {
            const bdc = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
            );
            if (bdc.ok) {
              const data = await bdc.json();
              const city = data.city || data.locality || data.principalSubdivision;
              const country = data.countryName || data.countryCode;
              setLocationName(city ? (country ? `${city}, ${country}` : city) : 'GPS Location');
            } else {
              setLocationName('GPS Location');
            }
          } catch {
            setLocationName('GPS Location');
          } finally {
            setLoading(false);
          }
        },
        () => {
          setLatitude(21.1702);
          setLongitude(72.8311);
          setLocationName('Surat, India');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLatitude(21.1702);
      setLongitude(72.8311);
      setLocationName('Surat, India');
      setLoading(false);
    }
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
      const photoUrls = photos.map((p) => p.uri);
      await completeOnboarding({
        name,
        dob,
        gender,
        bio: bio || undefined,
        interestedIn,
        latitude,
        longitude,
        photos: photoUrls,
      });

      if (!skipPhotos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          await mobileApi.uploadPhoto(photos[i].uri, i);
        }
      }

      await refreshUser();
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text style={styles.checkingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.cardWrapper}>
          {/* Header Info */}
          <View style={styles.headerBlock}>
            <Text style={styles.stepBadge}>Step {step} of 4</Text>
            <Text style={styles.headerTitle}>
              {step === 1 && 'Tell us about you'}
              {step === 2 && 'Who are you interested in?'}
              {step === 3 && 'Enable location'}
              {step === 4 && 'Add your photos'}
            </Text>
            <Text style={styles.headerSub}>
              {step === 1 && 'This helps us build your profile.'}
              {step === 2 && 'Pick one or more options.'}
              {step === 3 && 'We only use this to show people nearby.'}
              {step === 4 && 'Profiles with photos get more matches.'}
            </Text>
          </View>

          {/* STEP 1: Tell us about you */}
          {step === 1 && (
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex Sharma"
                  placeholderTextColor="#71717a"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (error) setError('');
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of birth</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#71717a"
                  value={dob}
                  onChangeText={(val) => {
                    setDob(val);
                    if (error) setError('');
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>I am a</Text>
                <View style={styles.grid3}>
                  {GENDERS.map((g) => {
                    const isSelected = gender === g.value;
                    return (
                      <TouchableOpacity
                        key={g.value}
                        style={[styles.selectBtn, isSelected && styles.selectBtnActive]}
                        onPress={() => {
                          setGender(g.value);
                          if (error) setError('');
                        }}
                      >
                        <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: Who are you interested in? */}
          {step === 2 && (
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Show me</Text>
                <View style={styles.grid3}>
                  {INTERESTS.map((g) => {
                    const isSelected = interestedIn.includes(g.value);
                    return (
                      <TouchableOpacity
                        key={g.value}
                        style={[styles.selectBtn, isSelected && styles.selectBtnActive]}
                        onPress={() => {
                          toggleInterest(g.value);
                          if (error) setError('');
                        }}
                      >
                        <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Passions & Lifestyle</Text>
                <View style={styles.passionsContainer}>
                  {PASSION_TAGS.map((tag) => {
                    const isSelected = selectedPassions.includes(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        style={[styles.passionChip, isSelected && styles.passionChipActive]}
                        onPress={() => togglePassion(tag.id)}
                      >
                        <Text style={[styles.passionChipText, isSelected && styles.passionChipTextActive]}>
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="A little about you..."
                  placeholderTextColor="#71717a"
                  multiline
                  value={bio}
                  onChangeText={setBio}
                />
              </View>
            </View>
          )}

          {/* STEP 3: Enable location */}
          {step === 3 && (
            <View style={styles.formSection}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                onPress={requestLocation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Use my current location</Text>
                )}
              </TouchableOpacity>

              {latitude != null && longitude != null && (
                <Text style={styles.locationSuccessText}>
                  Location set: {locationName || 'Ready'} ({latitude.toFixed(3)}, {longitude.toFixed(3)})
                </Text>
              )}

              <View style={styles.cityPresetBlock}>
                <Text style={styles.label}>Or Pick a Popular City:</Text>
                <View style={styles.grid2}>
                  {POPULAR_CITIES.map((c) => (
                    <TouchableOpacity
                      key={c.name}
                      style={styles.cityBtn}
                      onPress={() => selectCity(c)}
                    >
                      <Text style={styles.cityBtnText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* STEP 4: Add your photos */}
          {step === 4 && (
            <View style={styles.formSection}>
              <View style={styles.photosGrid}>
                {photos.map((photo, i) => (
                  <View key={i} style={styles.photoBox}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                    {i === 0 && (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>COVER</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.photoDeleteBtn}
                      onPress={() => removePhoto(i)}
                    >
                      <Ionicons name="close" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {photos.length < 6 && (
                  <TouchableOpacity style={styles.addPhotoCard} onPress={handlePhotoAdd}>
                    <Text style={styles.plusIconText}>+</Text>
                    <Text style={styles.addPhotoLabel}>Add photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Navigation Controls */}
          <View style={styles.footerNavRow}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setError('');
                  setStep((s) => s - 1);
                }}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 4 ? (
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  styles.flex1,
                  ((step === 1 && (!name || !dob || !gender)) ||
                    (step === 2 && interestedIn.length === 0) ||
                    (step === 3 && (latitude == null || longitude == null))) &&
                    styles.btnDisabled,
                ]}
                disabled={
                  (step === 1 && (!name || !dob || !gender)) ||
                  (step === 2 && interestedIn.length === 0) ||
                  (step === 3 && (latitude == null || longitude == null))
                }
                onPress={() => {
                  setError('');
                  setStep((s) => s + 1);
                }}
              >
                <Text style={styles.primaryActionBtnText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.finishContainer}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, loading && styles.btnDisabled]}
                  disabled={loading}
                  onPress={() => finishSetup(false)}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>Finish & start swiping</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={loading}
                  onPress={() => finishSetup(true)}
                  style={styles.skipPhotosLink}
                >
                  <Text style={styles.skipPhotosText}>Skip photos for now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  headerBlock: {
    marginBottom: 24,
  },
  stepBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f43f5e',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 6,
  },
  formSection: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  input: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  grid3: {
    flexDirection: 'row',
    gap: 8,
  },
  selectBtn: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnActive: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  selectBtnText: {
    fontSize: 13,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  selectBtnTextActive: {
    color: '#f43f5e',
    fontWeight: '600',
  },
  primaryActionBtn: {
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  locationSuccessText: {
    fontSize: 14,
    color: '#4ade80',
    textAlign: 'center',
    marginTop: 10,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoBox: {
    position: 'relative',
    width: '30%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#18181b',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoCard: {
    width: '30%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
  },
  plusIconText: {
    fontSize: 24,
    color: '#71717a',
  },
  addPhotoLabel: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    color: '#f87171',
    marginBottom: 14,
  },
  footerNavRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  flex1: {
    flex: 1,
  },
  finishContainer: {
    flex: 1,
    gap: 8,
  },
  skipPhotosLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipPhotosText: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  passionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  passionChip: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  passionChipActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#f43f5e',
  },
  passionChipText: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  passionChipTextActive: {
    color: '#f43f5e',
    fontWeight: '600',
  },
  cityPresetBlock: {
    marginTop: 14,
    gap: 8,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cityBtnText: {
    fontSize: 12,
    color: '#e4e4e7',
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#f43f5e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
});

