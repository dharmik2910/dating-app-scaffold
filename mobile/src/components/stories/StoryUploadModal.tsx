import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '@/services/api';

interface StoryUploadModalProps {
  onClose: () => void;
  onStoryUploaded: () => void;
}

const QUICK_MOODS = [
  { label: '🔥 Vibing', tag: 'Vibing' },
  { label: '✨ Weekend', tag: 'Weekend' },
  { label: '☕ Coffee Run', tag: 'Coffee Run' },
  { label: '🍕 Foodie', tag: 'Foodie' },
  { label: '🎧 Listening', tag: 'Listening' },
  { label: '✈️ Traveling', tag: 'Traveling' },
];

export default function StoryUploadModal({
  onClose,
  onStoryUploaded,
}: StoryUploadModalProps) {
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);

  async function pickImageFromGallery() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission needed', 'Please allow photo gallery access to upload a story.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('Pick image error:', e);
      Alert.alert('Error', 'Failed to pick image.');
    }
  }

  async function takePhotoWithCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted' && Platform.OS !== 'web') {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('Take photo error:', e);
      Alert.alert('Error', 'Failed to capture photo.');
    }
  }

  async function handleUploadStory() {
    if (!selectedUri) {
      Alert.alert('Select a photo', 'Please pick a photo or take a picture first.');
      return;
    }

    setUploading(true);
    try {
      const uploadRes = await mobileApi.uploadStoryMedia(selectedUri);
      const mediaUrl = uploadRes?.mediaUrl || selectedUri;

      await mobileApi.createStory(mediaUrl, 'image', caption.trim());
      onStoryUploaded();
      onClose();
    } catch (e: any) {
      console.warn('Upload story error:', e);
      Alert.alert('Error', e?.message || 'Failed to post story. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal visible={true} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBrandRow}>
            <View style={styles.sparkleIconBox}>
              <Ionicons name="sparkles" size={16} color="#f43f5e" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Create New Story</Text>
              <Text style={styles.headerSubtitle}>Expires after 24 hours ⏳</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={uploading}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Media Preview Box */}
          {selectedUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={() => setSelectedUri(null)}
                disabled={uploading}
              >
                <Ionicons name="trash-outline" size={18} color="#ffffff" />
                <Text style={styles.changePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickerBox}>
              <Ionicons name="images-outline" size={54} color="#52525b" />
              <Text style={styles.pickerTitle}>Add a Photo to Your Story</Text>
              <Text style={styles.pickerSub}>
                Share special moments, vibes, or weekend fun with your matches.
              </Text>

              <View style={styles.pickerBtnRow}>
                <TouchableOpacity
                  style={styles.pickGalleryBtn}
                  onPress={pickImageFromGallery}
                  activeOpacity={0.85}
                >
                  <Ionicons name="image" size={18} color="#ffffff" />
                  <Text style={styles.pickGalleryText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickCameraBtn}
                  onPress={takePhotoWithCamera}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera" size={18} color="#ffffff" />
                  <Text style={styles.pickCameraText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick Mood Chips */}
          <View style={styles.moodSection}>
            <Text style={styles.sectionLabel}>Add a Quick Mood</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodScroll}
            >
              {QUICK_MOODS.map((mood) => {
                const isSelected = caption.includes(mood.tag);
                return (
                  <TouchableOpacity
                    key={mood.tag}
                    style={[styles.moodChip, isSelected && styles.moodChipActive]}
                    onPress={() => {
                      if (isSelected) {
                        setCaption((prev) => prev.replace(mood.label, '').trim());
                      } else {
                        setCaption((prev) => (prev ? `${prev} ${mood.label}` : mood.label));
                      }
                    }}
                  >
                    <Text style={[styles.moodText, isSelected && styles.moodTextActive]}>
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Caption Input */}
          <View style={styles.captionSection}>
            <Text style={styles.sectionLabel}>Story Caption (Optional)</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a vibe or caption..."
              placeholderTextColor="#71717a"
              value={caption}
              onChangeText={setCaption}
              maxLength={120}
              multiline
            />
          </View>
        </ScrollView>

        {/* Bottom Post Action */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.postBtn,
              (!selectedUri || uploading) && styles.postBtnDisabled,
            ]}
            onPress={handleUploadStory}
            disabled={!selectedUri || uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#ffffff" />
                <Text style={styles.postBtnText}>Share Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
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
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#a1a1aa',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#18181b',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  pickerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    borderStyle: 'dashed',
    padding: 28,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 14,
  },
  pickerSub: {
    fontSize: 12,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  pickerBtnRow: {
    gap: 10,
    width: '100%',
  },
  pickGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f43f5e',
    paddingVertical: 14,
    borderRadius: 18,
  },
  pickGalleryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  pickCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27272a',
    paddingVertical: 14,
    borderRadius: 18,
  },
  pickCameraText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewContainer: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changePhotoBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  moodSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moodScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  moodChipActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#f43f5e',
  },
  moodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  moodTextActive: {
    color: '#f43f5e',
  },
  captionSection: {
    gap: 8,
  },
  captionInput: {
    backgroundColor: '#18181b',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    minHeight: 60,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    backgroundColor: '#09090b',
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f43f5e',
    paddingVertical: 14,
    borderRadius: 20,
  },
  postBtnDisabled: {
    opacity: 0.4,
  },
  postBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
