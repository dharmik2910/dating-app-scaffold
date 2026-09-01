import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { mobileApi } from '@/services/api';

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

function parseBioContent(rawBio?: string) {
  if (!rawBio) return { cleanBio: '', interests: [] };
  const match = rawBio.match(/\[INTERESTS:(.*?)\]/);
  if (match && match[1]) {
    const interests = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    const cleanBio = rawBio.replace(/\[INTERESTS:.*?\]/, '').trim();
    return { cleanBio, interests };
  }
  return { cleanBio: rawBio.trim(), interests: [] };
}

function formatBioWithInterests(cleanBio: string, interests: string[]) {
  if (interests.length === 0) return cleanBio.trim();
  return `${cleanBio.trim()}\n\n[INTERESTS:${interests.join(',')}]`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, refreshUser } = useAuth();
  const { handleScroll } = useTabBarVisibility();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  // Profile Form State
  const [name, setName] = useState('');
  const [gender, setGender] = useState('MALE');
  const [preference, setPreference] = useState('FEMALE');
  const [bioText, setBioText] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await mobileApi.getMe();
      if (res) {
        const rawBio = res.profile?.bio || res.bio || '';
        const { cleanBio, interests: bioInterests } = parseBioContent(rawBio);

        setName(res.profile?.name || res.name || '');
        setGender(res.profile?.gender || res.gender || 'MALE');

        const prefs = res.profile?.interestedIn || res.interestedIn || [];
        if (Array.isArray(prefs) && prefs.length > 1) {
          setPreference('EVERYONE');
        } else if (Array.isArray(prefs) && prefs[0]) {
          setPreference(prefs[0]);
        } else {
          setPreference('FEMALE');
        }

        setBioText(cleanBio);

        const userInterests = bioInterests.length > 0 ? bioInterests : res.interests || [];
        setSelectedInterests(userInterests);

        const userPhotos = res.photos || res.profile?.photos || [];
        setPhotos(userPhotos);
      }
    } catch (e) {
      console.warn('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  }

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((i) => i !== interestId)
        : prev.length < 6
        ? [...prev, interestId]
        : prev
    );
  };

  const calculateCompleteness = () => {
    let score = 0;
    if (name.trim()) score += 20;
    if (photos.length >= 1) score += 25;
    if (photos.length >= 3) score += 15;
    if (bioText.trim().length > 10) score += 20;
    if (selectedInterests.length >= 3) score += 20;
    return Math.min(100, score);
  };

  const completenessScore = calculateCompleteness();

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }

    setSaving(true);
    try {
      const interestedInArray =
        preference === 'EVERYONE'
          ? ['MALE', 'FEMALE', 'NONBINARY', 'OTHER']
          : [preference];

      const fullBio = formatBioWithInterests(bioText, selectedInterests);

      await mobileApi.updateProfile({
        name,
        gender,
        interestedIn: interestedInArray,
        bio: fullBio,
      });

      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoAdd() {
    if (photos.length >= 6) return;

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
          await mobileApi.uploadPhoto(URL.createObjectURL(file), photos.length);
          await fetchProfile();
        } catch (err) {
          console.warn('Upload photo error:', err);
        } finally {
          setUploadingPhoto(false);
        }
      };
      input.click();
    } else {
      const samplePhotos = [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop',
      ];
      setUploadingPhoto(true);
      const nextUri = samplePhotos[photos.length % samplePhotos.length];

      mobileApi
        .uploadPhoto(nextUri, photos.length)
        .then(async () => {
          await fetchProfile();
        })
        .catch((err) => console.warn('Upload photo error:', err))
        .finally(() => setUploadingPhoto(false));
    }
  }

  async function handleDeletePhoto(photoItem: any) {
    const photoId = typeof photoItem === 'string' ? photoItem : photoItem?.id;
    if (!photoId) return;

    setDeletingPhotoId(photoId);
    try {
      await mobileApi.deletePhoto(photoId);
      await fetchProfile();
    } catch (e) {
      console.warn('Delete photo error:', e);
    } finally {
      setDeletingPhotoId(null);
    }
  }

  function handleLogout() {
    logout();
    router.replace('/auth');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Studio Header Section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="person" size={20} color="#f43f5e" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Profile Studio</Text>
            <Text style={styles.headerSub}>Manage profile details & preferences</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color="#f43f5e" />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text style={styles.loadingText}>Loading profile data...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Profile Strength Meter Card */}
          <View style={styles.cardContainer}>
            <View style={styles.meterTopRow}>
              <View style={styles.meterTitleRow}>
                <Ionicons name="sparkles" size={18} color="#fbbf24" />
                <Text style={styles.cardSectionTitle}>Profile Strength</Text>
              </View>
              <Text style={styles.meterPercentText}>{completenessScore}%</Text>
            </View>

            {/* Progress Bar Track */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${completenessScore}%` }]} />
            </View>

            {/* Checklist Pills */}
            <View style={styles.checklistRow}>
              <View
                style={[
                  styles.checkPill,
                  photos.length >= 3 ? styles.checkPillActive : styles.checkPillInactive,
                ]}
              >
                {photos.length >= 3 && <Ionicons name="checkmark" size={12} color="#10b981" />}
                <Text
                  style={[
                    styles.checkPillText,
                    photos.length >= 3 ? styles.checkTextActive : styles.checkTextInactive,
                  ]}
                >
                  3+ Photos ({photos.length}/3)
                </Text>
              </View>

              <View
                style={[
                  styles.checkPill,
                  bioText.trim().length > 10 ? styles.checkPillActive : styles.checkPillInactive,
                ]}
              >
                {bioText.trim().length > 10 && <Ionicons name="checkmark" size={12} color="#10b981" />}
                <Text
                  style={[
                    styles.checkPillText,
                    bioText.trim().length > 10 ? styles.checkTextActive : styles.checkTextInactive,
                  ]}
                >
                  Detailed Bio
                </Text>
              </View>

              <View
                style={[
                  styles.checkPill,
                  selectedInterests.length >= 3 ? styles.checkPillActive : styles.checkPillInactive,
                ]}
              >
                {selectedInterests.length >= 3 && <Ionicons name="checkmark" size={12} color="#10b981" />}
                <Text
                  style={[
                    styles.checkPillText,
                    selectedInterests.length >= 3 ? styles.checkTextActive : styles.checkTextInactive,
                  ]}
                >
                  3+ Passions ({selectedInterests.length}/3)
                </Text>
              </View>
            </View>
          </View>

          {/* Profile Details Form Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderTitleRow}>
                <Ionicons name="person" size={20} color="#f43f5e" />
                <Text style={styles.cardSectionTitle}>Profile Details</Text>
              </View>
              <Text style={styles.cardHeaderSub}>Personal Information</Text>
            </View>

            {/* Display Name Input */}
            <View style={styles.formGroup}>
              <Text style={styles.uppercaseLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Your name"
                placeholderTextColor="#71717a"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Gender & Interested In Selection */}
            <View style={styles.formRow2Col}>
              <View style={styles.formCol}>
                <Text style={styles.uppercaseLabel}>Gender</Text>
                <View style={styles.segmentedControl}>
                  {[
                    { label: 'Male', val: 'MALE' },
                    { label: 'Female', val: 'FEMALE' },
                    { label: 'Other', val: 'NONBINARY' },
                  ].map((g) => (
                    <TouchableOpacity
                      key={g.val}
                      style={[styles.segmentBtn, gender === g.val && styles.segmentBtnActive]}
                      onPress={() => setGender(g.val)}
                    >
                      <Text style={[styles.segmentText, gender === g.val && styles.segmentTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formCol}>
                <Text style={styles.uppercaseLabel}>Interested In</Text>
                <View style={styles.segmentedControl}>
                  {[
                    { label: 'Women', val: 'FEMALE' },
                    { label: 'Men', val: 'MALE' },
                    { label: 'Everyone', val: 'EVERYONE' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.val}
                      style={[styles.segmentBtn, preference === p.val && styles.segmentBtnActive]}
                      onPress={() => setPreference(p.val)}
                    >
                      <Text style={[styles.segmentText, preference === p.val && styles.segmentTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Bio Textarea */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithCounterRow}>
                <Text style={styles.uppercaseLabel}>Bio</Text>
                <Text style={styles.counterText}>{bioText.length} / 500 characters</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Tell potential matches about your hobbies, passions, or what makes you smile..."
                placeholderTextColor="#71717a"
                value={bioText}
                onChangeText={setBioText}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>

            {/* Passions & Interests Selector */}
            <View style={styles.interestsSection}>
              <View style={styles.labelWithCounterRow}>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="sparkles" size={16} color="#fbbf24" />
                  <Text style={styles.subSectionTitle}>Passions & Interests</Text>
                </View>
                <Text style={styles.counterText}>{selectedInterests.length} / 6 selected</Text>
              </View>
              <Text style={styles.subSectionSubtitle}>
                Pick up to 6 interests to display on your candidate profile card
              </Text>

              <View style={styles.pillsWrapGrid}>
                {POPULAR_INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest.id);
                  return (
                    <TouchableOpacity
                      key={interest.id}
                      style={[styles.interestPill, isSelected && styles.interestPillSelected]}
                      onPress={() => toggleInterest(interest.id)}
                    >
                      <Text style={[styles.interestPillText, isSelected && styles.interestTextSelected]}>
                        {interest.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Save Profile Updates Action Button */}
            <TouchableOpacity
              style={[styles.gradientSaveBtn, saving && styles.btnDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#ffffff" />
                  <Text style={styles.gradientSaveBtnText}>Save Profile Updates</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Photos & Media Section Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="images" size={20} color="#f43f5e" />
                  <Text style={styles.cardSectionTitle}>Photos & Media</Text>
                </View>
                <Text style={styles.cardHeaderSub}>
                  Upload up to 6 photos. First photo is main profile photo.
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{photos.length} / 6</Text>
              </View>
            </View>

            <View style={styles.photoGridContainer}>
              {photos.map((photoItem, idx) => {
                const photoUrl = typeof photoItem === 'string' ? photoItem : photoItem.url;
                const photoId = typeof photoItem === 'string' ? photoItem : photoItem.id;
                const isDeleting = deletingPhotoId === photoId;

                return (
                  <View key={idx} style={styles.photoCardItem}>
                    <Image source={{ uri: photoUrl }} style={styles.photoCardImg} />
                    {idx === 0 && (
                      <View style={styles.mainPhotoTag}>
                        <Ionicons name="star" size={10} color="#ffffff" />
                        <Text style={styles.mainPhotoTagText}>MAIN PHOTO</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.deletePhotoTrashBtn}
                      onPress={() => handleDeletePhoto(photoItem)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}

              {photos.length < 6 && (
                <TouchableOpacity
                  style={styles.addPhotoDashedCard}
                  onPress={handlePhotoAdd}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color="#f43f5e" size="small" />
                  ) : (
                    <>
                      <View style={styles.plusCircleBadge}>
                        <Ionicons name="add" size={20} color="#f43f5e" />
                      </View>
                      <Text style={styles.addPhotoTitle}>Add Photo</Text>
                      <Text style={styles.addPhotoFormatText}>JPEG/PNG</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f43f5e',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  cardContainer: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 16,
  },
  meterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterPercentText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f43f5e',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#09090b',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f43f5e',
    borderRadius: 5,
  },
  checklistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  checkPillInactive: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
  },
  checkPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  checkTextActive: {
    color: '#34d399',
  },
  checkTextInactive: {
    color: '#a1a1aa',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 12,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardHeaderSub: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  uppercaseLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formGroup: {
    gap: 6,
  },
  formRow2Col: {
    gap: 12,
  },
  formCol: {
    gap: 6,
  },
  textInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#ffffff',
  },
  textAreaInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#f43f5e',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  labelWithCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterText: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '500',
  },
  interestsSection: {
    gap: 8,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  subSectionSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  pillsWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  interestPillSelected: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  interestPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  interestTextSelected: {
    color: '#ffffff',
  },
  gradientSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f43f5e',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  gradientSaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  photoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCardItem: {
    position: 'relative',
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  photoCardImg: {
    width: '100%',
    height: '100%',
  },
  mainPhotoTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainPhotoTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  deletePhotoTrashBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 63, 94, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoDashedCard: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
    gap: 4,
  },
  plusCircleBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  addPhotoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  addPhotoFormatText: {
    fontSize: 10,
    color: '#71717a',
  },
});
