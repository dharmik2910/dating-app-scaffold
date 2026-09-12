import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
        name: name.trim(),
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

  async function handlePhotoAdd() {
    if (photos.length >= 6) {
      Alert.alert('Limit Reached', 'You can upload up to 6 photos.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission needed', 'Please allow gallery access to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhoto(true);
        try {
          await mobileApi.uploadPhoto(result.assets[0].uri, photos.length);
          await fetchProfile();
        } catch (err: any) {
          console.warn('Upload photo error:', err);
          Alert.alert('Upload Error', err?.message || 'Failed to upload photo.');
        } finally {
          setUploadingPhoto(false);
        }
      }
    } catch (e: any) {
      console.warn('Pick image error:', e);
      Alert.alert('Error', 'Failed to pick image.');
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" translucent={true} />

      {/* Top Studio Header Section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="person" size={20} color="#f43f5e" />
          </View>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Profile Studio</Text>
            <Text style={styles.headerSub}>Manage profile details & photos</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
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
          showsVerticalScrollIndicator={false}
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
                  Bio added
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

          {/* Photos & Media Section Card (Primary Dating Profile Card) */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderInfo}>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="images" size={18} color="#f43f5e" />
                  <Text style={styles.cardSectionTitle}>Photos & Media</Text>
                </View>
                <Text style={styles.cardHeaderSub} numberOfLines={1}>
                  First photo is your main discovery card photo
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
                    <Image source={{ uri: photoUrl }} style={styles.photoCardImg} resizeMode="cover" />
                    {idx === 0 && (
                      <View style={styles.mainPhotoTag}>
                        <Ionicons name="star" size={10} color="#ffffff" />
                        <Text style={styles.mainPhotoTagText}>MAIN</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.deletePhotoTrashBtn}
                      onPress={() => handleDeletePhoto(photoItem)}
                      disabled={isDeleting}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Ionicons name="trash-outline" size={14} color="#ffffff" />
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
                  activeOpacity={0.8}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color="#f43f5e" size="small" />
                  ) : (
                    <>
                      <View style={styles.plusCircleBadge}>
                        <Ionicons name="add" size={22} color="#f43f5e" />
                      </View>
                      <Text style={styles.addPhotoTitle}>Add Photo</Text>
                      <Text style={styles.addPhotoFormatText}>Camera / Gallery</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Profile Details Form Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderInfo}>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="person" size={18} color="#f43f5e" />
                  <Text style={styles.cardSectionTitle}>Basic Details</Text>
                </View>
                <Text style={styles.cardHeaderSub}>How other members see you</Text>
              </View>
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
                <Text style={styles.uppercaseLabel}>I am</Text>
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
                      activeOpacity={0.8}
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
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.segmentText, preference === p.val && styles.segmentTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* About Me / Bio Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderInfo}>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="chatbox-ellipses" size={18} color="#f43f5e" />
                  <Text style={styles.cardSectionTitle}>About Me</Text>
                </View>
                <Text style={styles.cardHeaderSub}>Share what makes you unique</Text>
              </View>
              <Text style={styles.counterText}>{bioText.length}/500</Text>
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

          {/* Passions & Interests Selector Card */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderInfo}>
                <View style={styles.cardHeaderTitleRow}>
                  <Ionicons name="sparkles" size={18} color="#fbbf24" />
                  <Text style={styles.cardSectionTitle}>Passions & Interests</Text>
                </View>
                <Text style={styles.cardHeaderSub}>
                  Pick up to 6 interests for your profile card
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{selectedInterests.length} / 6</Text>
              </View>
            </View>

            <View style={styles.pillsWrapGrid}>
              {POPULAR_INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest.id);
                return (
                  <TouchableOpacity
                    key={interest.id}
                    style={[styles.interestPill, isSelected && styles.interestPillSelected]}
                    onPress={() => toggleInterest(interest.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.interestPillText, isSelected && styles.interestTextSelected]}>
                      {interest.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save Profile Button */}
          <TouchableOpacity
            style={[styles.gradientSaveBtn, saving && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="save" size={18} color="#ffffff" />
                <Text style={styles.gradientSaveBtnText}>Save Profile Updates</Text>
              </>
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitleGroup: {
    flex: 1,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
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
    paddingBottom: 90,
  },
  cardContainer: {
    backgroundColor: '#18181b',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 14,
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
    height: 8,
    backgroundColor: '#09090b',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#f43f5e',
    borderRadius: 4,
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
    paddingVertical: 5,
    borderRadius: 10,
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
    paddingBottom: 10,
  },
  cardHeaderInfo: {
    flex: 1,
    paddingRight: 10,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardHeaderSub: {
    fontSize: 11,
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
  counterText: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
  },
  pillsWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
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
    paddingVertical: 15,
    borderRadius: 18,
    marginTop: 4,
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4d4d8',
  },
  photoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCardItem: {
    position: 'relative',
    width: '31.3%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
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
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(244, 63, 94, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mainPhotoTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
  },
  deletePhotoTrashBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addPhotoDashedCard: {
    width: '31.3%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
    gap: 3,
    padding: 6,
  },
  plusCircleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  addPhotoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  addPhotoFormatText: {
    fontSize: 9,
    color: '#71717a',
    textAlign: 'center',
  },
});
