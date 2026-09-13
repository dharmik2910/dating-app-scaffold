import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Candidate, Match } from '@/constants/mockData';

const AUTH_STORAGE_KEY = 'ember_mobile_auth_token';

function getApiUrl(): string {
  // 1. In browser environments, dynamically use the current host so it always routes to the active backend
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:3001`;
  }

  // 2. Explicit environment override (e.g. for standalone native builds)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Dynamic host IP from Expo Metro bundler for physical devices and simulators
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).experienceUrl;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0].replace(/^[a-z]+:\/\//, '');
    if (hostIp) {
      return `http://${hostIp}:3001`;
    }
  }

  // 4. Android Emulator default
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  // 5. Default fallback
  return 'http://localhost:3001';
}

export const API_URL = getApiUrl();

let userAuthToken: string | null = null;

export async function setAuthToken(token: string | null): Promise<void> {
  userAuthToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('AsyncStorage setAuthToken error:', e);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem('accessToken', token);
    } else {
      window.localStorage.removeItem('accessToken');
    }
  }
}

export function getAuthToken(): string | null {
  return userAuthToken;
}

export async function loadStoredAuthToken(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      userAuthToken = stored;
      return stored;
    }
  } catch (e) {
    console.warn('AsyncStorage loadStoredAuthToken error:', e);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    userAuthToken = window.localStorage.getItem('accessToken');
  }
  return userAuthToken;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getAuthToken();
  if (!token) {
    token = await loadStoredAuthToken();
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `API error ${res.status}`;
    try {
      const errorJson = await res.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
      if (Array.isArray(errorMsg)) {
        errorMsg = errorMsg.join(', ');
      }
    } catch {
      const text = await res.text().catch(() => '');
      if (text) errorMsg = text;
    }

    if (res.status === 401) {
      // Only clear cached token if this was an authenticated route request with an expired token,
      // not during initial auth endpoints
      if (token && !path.startsWith('/auth/')) {
        await setAuthToken(null);
      }
    }

    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const mobileApi = {
  // Auth endpoints (AWS SNS SMS OTP)
  sendOtp: async (phone: string) => {
    return await request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyOtp: async (phone: string, code: string) => {
    const res = await request<{ accessToken: string; refreshToken?: string; isNewUser?: boolean; user?: any }>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }
    );
    if (res?.accessToken) {
      setAuthToken(res.accessToken);
    }
    return res;
  },

  sendWhatsappOtp: async (phone: string) => {
    return await request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyWhatsappOtp: async (phone: string, code: string) => {
    const res = await request<{ accessToken: string; refreshToken?: string; isNewUser?: boolean; user?: any }>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }
    );
    if (res?.accessToken) {
      setAuthToken(res.accessToken);
    }
    return res;
  },

  verifyFirebaseToken: async (idToken: string) => {
    const res = await request<{ accessToken: string; refreshToken?: string }>(
      '/auth/verify',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }
    );
    if (res?.accessToken) {
      setAuthToken(res.accessToken);
    }
    return res;
  },

  // User Profile
  getMe: async () => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      return await request('/users/me');
    } catch (e) {
      console.warn('getMe error:', e);
      return null;
    }
  },

  updateProfile: async (data: any) => {
    let safeDob = '2000-01-01T00:00:00.000Z';
    if (data.dob) {
      if (typeof data.dob === 'string' && data.dob.includes('T')) {
        safeDob = data.dob;
      } else {
        try {
          const parsed = new Date(data.dob);
          if (!isNaN(parsed.getTime())) {
            safeDob = parsed.toISOString();
          }
        } catch {
          safeDob = '2000-01-01T00:00:00.000Z';
        }
      }
    }

    const payload: Record<string, any> = {
      name: data.name || data.profile?.name || 'User',
      dob: safeDob,
      gender: data.gender || data.profile?.gender || 'other',
      interestedIn:
        Array.isArray(data.interestedIn) && data.interestedIn.length > 0
          ? data.interestedIn
          : data.profile?.interestedIn || ['other'],
    };

    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.latitude != null) payload.latitude = Number(data.latitude);
    if (data.longitude != null) payload.longitude = Number(data.longitude);
    if (data.minAge != null) payload.minAge = Number(data.minAge);
    if (data.maxAge != null) payload.maxAge = Number(data.maxAge);
    if (data.maxDistanceKm != null) payload.maxDistanceKm = Number(data.maxDistanceKm);
    if (data.interests !== undefined) payload.interests = data.interests;
    if (data.incognitoMode !== undefined) payload.incognitoMode = Boolean(data.incognitoMode);
    if (data.passportActive !== undefined) payload.passportActive = Boolean(data.passportActive);
    if (data.passportCity !== undefined) payload.passportCity = data.passportCity;
    if (data.passportLat != null) payload.passportLat = Number(data.passportLat);
    if (data.passportLng != null) payload.passportLng = Number(data.passportLng);
    if (data.twoTruths !== undefined) payload.twoTruths = data.twoTruths;
    if (data.voiceBioUrl !== undefined) payload.voiceBioUrl = data.voiceBioUrl;

    return await request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Photos
  uploadPhoto: async (uriOrUrl: string, order = 0, base64Data?: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // 1. Remote sample photo (e.g. Unsplash URL)
    if (uriOrUrl.startsWith('http://') || uriOrUrl.startsWith('https://')) {
      return await request('/photos/confirm', {
        method: 'POST',
        body: JSON.stringify({
          publicUrl: uriOrUrl,
          key: `sample-${Date.now()}-${order}.jpg`,
          order,
        }),
      });
    }

    // 2. Direct Base64 upload
    if (base64Data || uriOrUrl.startsWith('data:image')) {
      const rawBase64 = base64Data || uriOrUrl;
      return await request('/photos/upload-base64', {
        method: 'POST',
        body: JSON.stringify({
          base64: rawBase64,
          contentType: 'image/jpeg',
          order,
        }),
      });
    }

    // 3. Prepare FormData for Native (Android / iOS) vs Web
    const formData = new FormData();
    const cleanFilename = `photo_${Date.now()}_${order}.jpg`;

    if (Platform.OS === 'web') {
      try {
        const resp = await fetch(uriOrUrl);
        const blob = await resp.blob();
        formData.append('file', blob, cleanFilename);
      } catch {
        formData.append('file', uriOrUrl);
      }
    } else {
      // Native React Native (Android / iOS) FormDataPart structure
      formData.append('file', {
        uri: uriOrUrl,
        name: cleanFilename,
        type: 'image/jpeg',
      } as any);
    }
    formData.append('order', order.toString());

    const res = await fetch(`${API_URL}/photos/upload-file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  },

  deletePhoto: async (photoId: string) => {
    return await request(`/photos/${photoId}`, { method: 'DELETE' });
  },

  // Discovery / Swiping
  getDiscovery: async (cursor?: string, limit?: number): Promise<{ items: Candidate[]; nextCursor?: string; hasMore?: boolean }> => {
    const token = getAuthToken();
    if (!token) return { items: [], hasMore: false };
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    try {
      const data = await request(`/discovery${query ? `?${query}` : ''}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return { items, nextCursor: data.nextCursor, hasMore: Boolean(data.hasMore) };
    } catch (e) {
      return { items: [], hasMore: false };
    }
  },

  swipe: async (swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE') => {
    const token = getAuthToken();
    if (!token) return { status: 'RECORDED' };
    return await request('/swipes', {
      method: 'POST',
      body: JSON.stringify({ swipedId, action }),
    });
  },

  // Matches
  getMatches: async (
    cursor?: string,
    limit?: number,
    type?: 'matches' | 'conversations' | 'all'
  ): Promise<Match[]> => {
    const token = getAuthToken();
    if (!token) return [];
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', limit.toString());
      if (type) params.set('type', type);
      const query = params.toString();
      const data = await request(`/matches${query ? `?${query}` : ''}`);
      const rawItems = Array.isArray(data) ? data : data.items || [];

      return rawItems.map((m: any) => ({
        id: m.id,
        matchedAt: m.matchedAt ? new Date(m.matchedAt).toLocaleDateString() : 'Recently',
        user: {
          id: m.otherUser?.id || m.id,
          name: m.otherUser?.name || 'Match',
          avatar: m.otherUser?.photos?.[0]?.url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
          online: Boolean(m.otherUser?.isOnline),
          lastActiveAt: m.otherUser?.lastActiveAt || m.otherUser?.updatedAt,
          bio: m.otherUser?.bio || '',
          latitude: m.otherUser?.latitude,
          longitude: m.otherUser?.longitude,
        },
        lastMessage: m.messages?.[0]
          ? {
              text: m.messages[0].text,
              createdAt: m.messages[0].sentAt
                ? new Date(m.messages[0].sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recently',
              senderId: m.messages[0].senderId || '',
              unread: false,
            }
          : {
              text: 'Say hello! 👋',
              createdAt: 'Just now',
              senderId: '',
              unread: false,
            },
      }));
    } catch (e) {
      return [];
    }
  },

  // Chat History
  getChatHistory: async (matchId: string, cursor?: string, limit?: number) => {
    const token = getAuthToken();
    if (!token) return [];
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    try {
      return await request(`/chat/${matchId}/history${query ? `?${query}` : ''}`);
    } catch (e) {
      return [];
    }
  },

  clearChat: async (matchId: string) => {
    const token = getAuthToken();
    if (!token) return { success: true };
    return await request(`/chat/${matchId}/clear`, {
      method: 'DELETE',
    });
  },

  // Stories
  getStoriesFeed: async () => {
    const token = getAuthToken();
    if (!token) return [];
    try {
      const data = await request('/stories/feed');
      if (Array.isArray(data)) return data;
      return data?.items || [];
    } catch (e) {
      return [];
    }
  },

  createStory: async (mediaUrl: string, mediaType = 'image', caption?: string) => {
    return await request('/stories', {
      method: 'POST',
      body: JSON.stringify({ mediaUrl, mediaType, caption }),
    });
  },

  uploadStoryMedia: async (imageUri: string, base64Data?: string) => {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');

    // 1. Remote sample story (e.g. Unsplash URL)
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      return { mediaUrl: imageUri, key: `story_${Date.now()}` };
    }

    // 2. Direct Base64 upload (100% reliable across Android & iOS)
    if (base64Data || imageUri.startsWith('data:image')) {
      const rawBase64 = base64Data || imageUri;
      return (await request('/stories/upload-base64', {
        method: 'POST',
        body: JSON.stringify({
          base64: rawBase64,
          contentType: 'image/jpeg',
        }),
      })) as { mediaUrl: string; key: string };
    }

    // 3. Prepare FormData for Native (Android / iOS) vs Web
    const formData = new FormData();
    const cleanFilename = `story_${Date.now()}.jpg`;

    if (Platform.OS === 'web') {
      try {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        formData.append('file', blob, cleanFilename);
      } catch {
        formData.append('file', imageUri);
      }
    } else {
      // Native React Native (Android / iOS) FormDataPart structure
      formData.append('file', {
        uri: imageUri,
        name: cleanFilename,
        type: 'image/jpeg',
      } as any);
    }

    const res = await fetch(`${API_URL}/stories/upload-file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Story upload failed: ${await res.text()}`);
    return res.json() as Promise<{ mediaUrl: string; key: string }>;
  },

  markStoryViewed: async (storyId: string) => {
    return await request(`/stories/${storyId}/view`, { method: 'POST' });
  },

  deleteStory: async (storyId: string) => {
    return await request(`/stories/${storyId}`, { method: 'DELETE' });
  },

  getStoryViewers: async (storyId: string) => {
    return (await request(`/stories/${storyId}/viewers`)) as {
      viewerId: string;
      viewedAt: string;
      name: string;
      photoUrl: string | null;
      bio: string | null;
      age: number | null;
    }[];
  },

  // Photos
  getPhotoUploadUrl: async (contentType: string) => {
    return await request('/photos/upload-url', {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    });
  },

  confirmPhotoUpload: async (publicUrl: string, key: string, order?: number) => {
    return await request('/photos/confirm', {
      method: 'POST',
      body: JSON.stringify({ publicUrl, key, order }),
    });
  },

  // VIP & Swipes Extensions
  getWhoLikedMe: async () => {
    return await request('/swipes/who-liked-me');
  },

  boostProfile: async (durationMinutes = 30) => {
    return await request('/swipes/boost', {
      method: 'POST',
      body: JSON.stringify({ durationMinutes }),
    });
  },

  sendCompliment: async (
    receiverId: string,
    content: string,
    targetType = 'profile',
    targetId?: string,
  ) => {
    return await request('/swipes/compliment', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content, targetType, targetId }),
    });
  },

  // Discovery Modes
  getTopPicks: async () => {
    return await request('/discovery/top-picks');
  },

  getBlindDateQueue: async () => {
    return await request('/discovery/blind-date');
  },

  // AI Matching & Icebreakers
  getAiIcebreakers: async (targetUserId: string) => {
    return await request(`/ai/icebreakers/${targetUserId}`, { method: 'POST' });
  },

  getAiCompatibility: async (targetUserId: string) => {
    return await request(`/ai/compatibility/${targetUserId}`);
  },

  generateAiBio: async (vibe: 'funny' | 'romantic' | 'adventurous' | 'creative' = 'creative') => {
    return await request('/ai/generate-bio', {
      method: 'POST',
      body: JSON.stringify({ vibe }),
    });
  },

  setVoiceBio: async (voiceBioUrl: string | null) => {
    return await request('/users/me/voice-bio', {
      method: 'POST',
      body: JSON.stringify({ voiceBioUrl }),
    });
  },

  getSwipeQuota: async () => {
    return await request<{ remaining: number; isUnlimited: boolean; totalAllowed: number }>('/swipes/quota');
  },

  // Profile Prompts & Extended Fields
  addOrUpdatePrompt: async (question: string, answer: string, order = 0) => {
    return await request('/users/me/prompts', {
      method: 'POST',
      body: JSON.stringify({ question, answer, order }),
    });
  },

  deletePrompt: async (promptId: string) => {
    return await request(`/users/me/prompts/${promptId}`, { method: 'DELETE' });
  },

  getPublicProfile: async (userId: string) => {
    return await request(`/users/${userId}`);
  },

  // Safety & Trust
  blockUser: async (blockedId: string) => {
    return await request('/safety/block', {
      method: 'POST',
      body: JSON.stringify({ blockedId }),
    });
  },

  unblockUser: async (userId: string) => {
    return await request(`/safety/block/${userId}`, { method: 'DELETE' });
  },

  getBlockedUsers: async () => {
    return await request('/safety/blocked');
  },

  reportUser: async (reportedId: string, reason: string, details?: string) => {
    return await request('/safety/report', {
      method: 'POST',
      body: JSON.stringify({ reportedId, reason, details }),
    });
  },

  verifyPhoto: async (selfieUrl: string) => {
    return await request('/safety/verify-photo', {
      method: 'POST',
      body: JSON.stringify({ selfieUrl }),
    });
  },

  createSafeDate: async (data: {
    matchId: string;
    contactName: string;
    contactPhone: string;
    locationName: string;
    locationLat?: number;
    locationLng?: number;
    scheduledTime: string;
    notes?: string;
  }) => {
    return await request('/safety/safe-date', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSafeDates: async () => {
    return await request('/safety/safe-dates');
  },

  checkInSafeDate: async (id: string, status: 'SAFE' | 'ALERT' = 'SAFE') => {
    return await request(`/safety/safe-date/${id}/checkin`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // In-Chat Date Suggestion & Ephemeral Media
  sendDateInvite: async (
    matchId: string,
    data: { venueName: string; address?: string; dateTime: string; notes?: string },
  ) => {
    return await request(`/chat/${matchId}/date-invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  respondDateInvite: async (
    matchId: string,
    messageId: string,
    response: 'accepted' | 'declined',
  ) => {
    return await request(`/chat/${matchId}/date-invite/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ response }),
    });
  },

  viewEphemeralMedia: async (matchId: string, messageId: string) => {
    return await request(`/chat/${matchId}/ephemeral/${messageId}/view`, {
      method: 'POST',
    });
  },

  // Notifications
  registerPushToken: async (token: string, platform = 'expo') => {
    return await request('/notifications/token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  getNotifications: async () => {
    return await request('/notifications');
  },

  markNotificationAsRead: async (id: string) => {
    return await request(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllNotificationsAsRead: async () => {
    return await request('/notifications/read-all', { method: 'PATCH' });
  },
};
