import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Candidate, Match } from '@/constants/mockData';

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

export function setAuthToken(token: string | null) {
  userAuthToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem('accessToken', token);
    } else {
      window.localStorage.removeItem('accessToken');
    }
  }
}

export function getAuthToken(): string | null {
  if (!userAuthToken && typeof window !== 'undefined' && window.localStorage) {
    userAuthToken = window.localStorage.getItem('accessToken');
  }
  return userAuthToken;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    setAuthToken(null);
    throw new Error(`API error 401: Unauthorized`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

export const mobileApi = {
  // Auth endpoints
  sendWhatsappOtp: async (phone: string) => {
    return await request('/auth/send-whatsapp-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyWhatsappOtp: async (phone: string, code: string) => {
    const res = await request<{ accessToken: string; refreshToken?: string }>(
      '/auth/verify-whatsapp-otp',
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

    return await request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Photos
  uploadPhoto: async (uriOrUrl: string, order = 0) => {
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

    // 2. Web browser blob/file handling vs Native file
    let fileToSend: any;
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (
        uriOrUrl.startsWith('blob:') ||
        uriOrUrl.startsWith('data:')
      ) {
        try {
          const resp = await fetch(uriOrUrl);
          const blob = await resp.blob();
          fileToSend = new File([blob], `photo_${Date.now()}_${order}.jpg`, {
            type: blob.type || 'image/jpeg',
          });
        } catch {}
      }
    }

    const formData = new FormData();
    if (fileToSend) {
      formData.append('file', fileToSend);
    } else {
      const filename = uriOrUrl.split('/').pop() || `photo_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      formData.append('file', {
        uri: uriOrUrl,
        name: filename,
        type,
      } as any);
    }
    formData.append('order', order.toString());

    const res = await fetch(`${API_URL}/photos/upload-file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
          lastActiveAt: m.otherUser?.updatedAt,
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

  uploadStoryMedia: async (imageUri: string) => {
    let fileToSend: any;

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (
        imageUri.startsWith('http://') ||
        imageUri.startsWith('https://') ||
        imageUri.startsWith('data:') ||
        imageUri.startsWith('blob:')
      ) {
        try {
          const resp = await fetch(imageUri);
          const blob = await resp.blob();
          fileToSend = new File([blob], `story_${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg',
          });
        } catch {}
      }
    }

    const formData = new FormData();
    if (fileToSend) {
      formData.append('file', fileToSend);
    } else {
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `story_${Date.now()}.jpg`,
      } as any);
    }

    const token = getAuthToken();
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
};
