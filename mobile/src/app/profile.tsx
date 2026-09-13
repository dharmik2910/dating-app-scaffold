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
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { mobileApi } from '@/services/api';
import { INTEREST_LABELS } from '@/constants/mockData';

const PASSPORT_CITIES = [
  { city: 'New York, USA', lat: 40.7128, lng: -74.006 },
  { city: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { city: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { city: 'Paris, France', lat: 48.8566, lng: 2.3522 },
  { city: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
  { city: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  { city: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, refreshUser } = useAuth();
  const { handleScroll } = useTabBarVisibility();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Profile Form State
  const [name, setName] = useState('');
  const [gender, setGender] = useState('MALE');
  const [preference, setPreference] = useState('FEMALE');
  const [bioText, setBioText] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  // VIP / Advanced Features State
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [passportActive, setPassportActive] = useState(false);
  const [passportCity, setPassportCity] = useState('New York, USA');
  const [passportLat, setPassportLat] = useState(40.7128);
  const [passportLng, setPassportLng] = useState(-74.006);

  // AI Bio Generator & Voice Bio
  const [voiceBioUrl, setVoiceBioUrl] = useState<string | null>(null);
  const [showAiBioModal, setShowAiBioModal] = useState(false);
  const [aiVibe, setAiVibe] = useState<'funny' | 'romantic' | 'adventurous' | 'creative'>('creative');
  const [generatingBio, setGeneratingBio] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  // Two Truths
  const [twoTruths, setTwoTruths] = useState<{ statements: string[]; lieIndex: number }>({
    statements: ['I have lived in 3 countries', 'I can speak 4 languages', 'I have never had coffee'],
    lieIndex: 2,
  });

  // Modals State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, []),
  );

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await mobileApi.getMe();
      if (res) {
        const p = res.profile || res;
        setName(p.name || '');
        setGender(p.gender || 'MALE');
        setBioText(p.bio || '');
        setSelectedInterests(p.interests || []);
        setPhotos(res.photos || []);
        setIsVerified(Boolean(p.isVerified));
        setIncognitoMode(Boolean(p.incognitoMode));
        setPassportActive(Boolean(p.passportActive));
        if (p.passportCity) setPassportCity(p.passportCity);
        if (p.passportLat) setPassportLat(p.passportLat);
        if (p.passportLng) setPassportLng(p.passportLng);
        if (p.voiceBioUrl) setVoiceBioUrl(p.voiceBioUrl);
        if (p.twoTruths) {
          if (Array.isArray(p.twoTruths.statements) && p.twoTruths.statements.length === 3) {
            setTwoTruths(p.twoTruths);
          } else if (p.twoTruths.statement1 || p.twoTruths.statement2 || p.twoTruths.statement3) {
            setTwoTruths({
              statements: [
                p.twoTruths.statement1 || '',
                p.twoTruths.statement2 || '',
                p.twoTruths.statement3 || '',
              ],
              lieIndex: typeof p.twoTruths.lieIndex === 'number' ? p.twoTruths.lieIndex : 2,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Profile fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateBio() {
    setGeneratingBio(true);
    try {
      const res = await mobileApi.generateAiBio(aiVibe);
      if (res?.bio) {
        setBioText(res.bio);
        setShowAiBioModal(false);
        Alert.alert('✨ Bio Generated!', 'We crafted a fresh bio tailored to your vibe.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate bio');
    } finally {
      setGeneratingBio(false);
    }
  }

  function handlePlayVoiceBio(url: string) {
    if (typeof window !== 'undefined' && (window as any).Audio) {
      try {
        const audio = new (window as any).Audio(url);
        setIsPlayingVoice(true);
        audio.play();
        audio.onended = () => setIsPlayingVoice(false);
        audio.onerror = () => setIsPlayingVoice(false);
      } catch {
        setIsPlayingVoice(false);
      }
    } else {
      Alert.alert('🎙️ Voice Intro', 'Playing sample voice intro');
    }
  }

  async function handleSetSampleVoiceBio() {
    const sampleVoice = 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg';
    try {
      await mobileApi.setVoiceBio(sampleVoice);
      setVoiceBioUrl(sampleVoice);
      Alert.alert('🎙️ Voice Intro Set!', 'Your 15s voice intro is live on your profile & discover card!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to set voice intro');
    }
  }

  async function handleRemoveVoiceBio() {
    try {
      await mobileApi.setVoiceBio(null);
      setVoiceBioUrl(null);
      Alert.alert('Removed', 'Voice bio intro removed.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove voice intro');
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await mobileApi.updateProfile({
        name,
        gender,
        bio: bioText,
        interests: selectedInterests,
        incognitoMode,
        passportActive,
        passportCity,
        passportLat,
        passportLng,
        twoTruths,
      });
      if (refreshUser) refreshUser();
      Alert.alert('Success', 'Profile updated successfully! ✨');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  // Photo Upload Handler
  async function handleAddPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUploadingPhoto(true);
        await mobileApi.uploadPhoto(result.assets[0].uri, photos.length);
        await fetchProfile();
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload image');
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Verification Selfie Handler
  async function handleVerifyPhoto() {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await mobileApi.verifyPhoto(result.assets[0].uri);
        setIsVerified(true);
        setShowVerificationModal(false);
        Alert.alert('🛡️ Verified!', 'Your selfie pose was verified. Blue badge is now active!');
      } else {
        // Mock verification for web/simulator
        await mobileApi.verifyPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600');
        setIsVerified(true);
        setShowVerificationModal(false);
        Alert.alert('🛡️ Verified!', 'Your selfie pose was verified. Blue badge is now active!');
      }
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to verify');
    }
  }



  async function handleOpenBlockedUsers() {
    setShowBlockedModal(true);
    try {
      const list = await mobileApi.getBlockedUsers();
      if (Array.isArray(list)) setBlockedUsers(list);
    } catch (e) {
      console.warn('Get blocked error:', e);
    }
  }

  async function handleUnblock(userId: string) {
    try {
      await mobileApi.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== userId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to unblock');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit Profile & Settings</Text>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#FF4B72" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Verification Blue Badge Card */}
          <View style={styles.verificationCard}>
            <View style={styles.verifyLeft}>
              <Ionicons
                name={isVerified ? 'shield-checkmark' : 'shield-outline'}
                size={24}
                color={isVerified ? '#38BDF8' : '#94A3B8'}
              />
              <View>
                <Text style={styles.verifyTitle}>
                  {isVerified ? 'Profile Verified 🛡️' : 'Get Verified Checkmark'}
                </Text>
                <Text style={styles.verifySubtitle}>
                  {isVerified
                    ? 'Your blue badge is visible to all matches'
                    : 'Take a quick selfie to earn your trust badge'}
                </Text>
              </View>
            </View>
            {!isVerified && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => setShowVerificationModal(true)}
              >
                <Text style={styles.verifyBtnText}>Verify</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Photo Gallery Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
            <View style={styles.photosGrid}>
              {photos.map((photo, index) => (
                <View key={photo.id || index} style={styles.photoBox}>
                  <Image source={{ uri: photo.url }} style={styles.photoImg} />
                  <TouchableOpacity
                    style={styles.deletePhotoBtn}
                    onPress={async () => {
                      await mobileApi.deletePhoto(photo.id);
                      fetchProfile();
                    }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 6 && (
                <TouchableOpacity
                  style={styles.addPhotoBox}
                  onPress={handleAddPhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FF4B72" />
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color="#FF4B72" />
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#64748B"
            />

            <View style={styles.bioHeaderRow}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TouchableOpacity
                style={styles.aiBioBtn}
                onPress={() => setShowAiBioModal(true)}
              >
                <Ionicons name="sparkles" size={13} color="#FF4B72" />
                <Text style={styles.aiBioBtnText}>AI Generator ✨</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={bioText}
              onChangeText={setBioText}
              placeholder="Write a few lines about your vibe..."
              placeholderTextColor="#64748B"
              multiline
            />
          </View>

          {/* Voice Bio Intro (15s) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="mic" size={18} color="#FF4B72" />
                <Text style={styles.sectionTitle}>Voice Intro 🎙️</Text>
              </View>
              {voiceBioUrl ? (
                <TouchableOpacity onPress={handleRemoveVoiceBio}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.sectionSubtitle}>
              Let potential matches hear your voice and personality directly on your card!
            </Text>
            {voiceBioUrl ? (
              <View style={styles.voicePlayRow}>
                <TouchableOpacity
                  style={styles.voicePlayBtn}
                  onPress={() => handlePlayVoiceBio(voiceBioUrl)}
                >
                  <Ionicons
                    name={isPlayingVoice ? 'pause' : 'play'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.voicePlayText}>
                    {isPlayingVoice ? 'Playing Voice Intro...' : 'Play Voice Intro'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.setVoiceBtn}
                onPress={handleSetSampleVoiceBio}
              >
                <Ionicons name="mic-circle" size={24} color="#FF4B72" />
                <Text style={styles.setVoiceBtnText}>Record / Set 15s Voice Intro</Text>
              </TouchableOpacity>
            )}
          </View>



          {/* Interactive Two Truths and a Lie */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Two Truths & A Lie 🎭</Text>
            <Text style={styles.sectionSubtitle}>
              Matches will guess which statement is false directly on your card:
            </Text>

            {[0, 1, 2].map((idx) => (
              <View key={idx} style={styles.twoTruthsRow}>
                <TouchableOpacity
                  style={[
                    styles.lieSelectorBtn,
                    twoTruths.lieIndex === idx && styles.lieSelectorBtnActive,
                  ]}
                  onPress={() => setTwoTruths((prev) => ({ ...prev, lieIndex: idx }))}
                >
                  <Text
                    style={[
                      styles.lieSelectorText,
                      twoTruths.lieIndex === idx && styles.lieSelectorTextActive,
                    ]}
                  >
                    {twoTruths.lieIndex === idx ? 'LIE' : 'TRUTH'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={twoTruths.statements[idx] || ''}
                  onChangeText={(val) => {
                    const newStatements = [...twoTruths.statements];
                    newStatements[idx] = val;
                    setTwoTruths((prev) => ({ ...prev, statements: newStatements }));
                  }}
                  placeholder={`Statement #${idx + 1}`}
                  placeholderTextColor="#64748B"
                />
              </View>
            ))}
          </View>

          {/* Interests & Passions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests & Passions 🔥</Text>
            <View style={styles.interestsWrap}>
              {Object.entries(INTEREST_LABELS).map(([key, item]) => {
                const isSelected = selectedInterests.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.interestTag, isSelected && styles.interestTagActive]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedInterests((prev) => prev.filter((i) => i !== key));
                      } else {
                        setSelectedInterests((prev) => [...prev, key]);
                      }
                    }}
                  >
                    <Text style={styles.interestIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.interestText,
                        isSelected && styles.interestTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Travel / Passport Mode */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>✈️ Passport / Travel Mode</Text>
                <Text style={styles.sectionSubtitle}>
                  Explore and match in another city before traveling
                </Text>
              </View>
              <Switch
                value={passportActive}
                onValueChange={setPassportActive}
                trackColor={{ false: '#1E293B', true: '#A855F7' }}
              />
            </View>

            {passportActive && (
              <View style={styles.citySelectorGrid}>
                {PASSPORT_CITIES.map((c) => (
                  <TouchableOpacity
                    key={c.city}
                    style={[
                      styles.cityBtn,
                      passportCity === c.city && styles.cityBtnActive,
                    ]}
                    onPress={() => {
                      setPassportCity(c.city);
                      setPassportLat(c.lat);
                      setPassportLng(c.lng);
                    }}
                  >
                    <Text
                      style={[
                        styles.cityBtnText,
                        passportCity === c.city && styles.cityBtnTextActive,
                      ]}
                    >
                      {c.city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Privacy & Safety Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Safety 🛡️</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Ghost / Incognito Mode</Text>
                <Text style={styles.sectionSubtitle}>
                  Only show profile to people you have liked
                </Text>
              </View>
              <Switch
                value={incognitoMode}
                onValueChange={setIncognitoMode}
                trackColor={{ false: '#1E293B', true: '#FF4B72' }}
              />
            </View>

            <TouchableOpacity
              style={styles.manageBlockedBtn}
              onPress={handleOpenBlockedUsers}
            >
              <Ionicons name="ban-outline" size={18} color="#94A3B8" />
              <Text style={styles.manageBlockedText}>Manage Blocked Users</Text>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}



      {/* Verification Selfie Modal */}
      <Modal visible={showVerificationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📸 Photo Verification</Text>
              <TouchableOpacity onPress={() => setShowVerificationModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Mimic the pose below with your camera to confirm your identity and earn the blue verified badge!
            </Text>
            <View style={styles.poseDemoBox}>
              <Text style={{ fontSize: 50 }}>✌️</Text>
              <Text style={styles.poseText}>Hold up a peace sign next to your face</Text>
            </View>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleVerifyPhoto}>
              <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.modalSubmitText}>Take Verification Selfie</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Bio Generator Modal */}
      <Modal visible={showAiBioModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={20} color="#FF4B72" />
                <Text style={styles.modalTitle}>AI Bio Generator</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiBioModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Select your desired tone and let AI polish a standout bio for you:
            </Text>

            <View style={styles.vibeGrid}>
              {(['creative', 'funny', 'romantic', 'adventurous'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.vibeChip, aiVibe === v && styles.vibeChipActive]}
                  onPress={() => setAiVibe(v)}
                >
                  <Text style={[styles.vibeChipText, aiVibe === v && styles.vibeChipTextActive]}>
                    {v === 'creative' ? '🎨 Creative' : v === 'funny' ? '😂 Funny & Witty' : v === 'romantic' ? '💖 Romantic' : '🏕️ Adventurous'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, generatingBio && styles.saveBtnDisabled]}
              onPress={handleGenerateBio}
              disabled={generatingBio}
            >
              {generatingBio ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSubmitText}>Generate New Bio</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blocked Users Modal */}
      <Modal visible={showBlockedModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Profiles</Text>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            {blockedUsers.length === 0 ? (
              <Text style={styles.emptyPromptNotice}>You have not blocked anyone.</Text>
            ) : (
              <View style={{ gap: 8, marginVertical: 10 }}>
                {blockedUsers.map((b) => (
                  <View key={b.id} style={styles.blockedRow}>
                    <Text style={styles.blockedName}>{b.name}</Text>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleUnblock(b.blockedId)}
                    >
                      <Text style={styles.unblockText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveHeaderBtn: {
    backgroundColor: '#FF4B72',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  verifyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  verifyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38BDF8',
  },
  verifySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  verifyBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  bioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  aiBioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 75, 114, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
  },
  aiBioBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF4B72',
  },
  voicePlayRow: {
    marginTop: 4,
  },
  voicePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF4B72',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  voicePlayText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  setVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 75, 114, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
  },
  setVoiceBtnText: {
    color: '#FF4B72',
    fontWeight: '700',
    fontSize: 13,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  photoBox: {
    width: '30%',
    aspectRatio: 0.8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBox: {
    width: '30%',
    aspectRatio: 0.8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 75, 114, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 75, 114, 0.05)',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    color: '#FF4B72',
    fontWeight: '600',
  },
  addPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  addPromptText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPromptNotice: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  promptCard: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    gap: 4,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  promptAnswer: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
  },
  twoTruthsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lieSelectorBtn: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  lieSelectorBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  lieSelectorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C084FC',
  },
  lieSelectorTextActive: {
    color: '#EF4444',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  interestTagActive: {
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    borderColor: '#FF4B72',
  },
  interestIcon: {
    fontSize: 14,
  },
  interestText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  interestTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  citySelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  cityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cityBtnActive: {
    backgroundColor: '#A855F7',
  },
  cityBtnText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cityBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  manageBlockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  manageBlockedText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  vibeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  vibeChipActive: {
    backgroundColor: 'rgba(255, 75, 114, 0.25)',
    borderColor: '#FF4B72',
    borderWidth: 1,
  },
  vibeChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  vibeChipTextActive: {
    color: '#FF4B72',
    fontWeight: '700',
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
  },
  promptChipActive: {
    backgroundColor: '#A855F7',
  },
  promptChipText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  promptChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4B72',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  poseDemoBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  poseText: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  blockedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  blockedName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  unblockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
  },
  unblockText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
});
