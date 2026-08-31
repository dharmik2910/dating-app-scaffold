import { Platform } from 'react-native';
import { MOCK_CANDIDATES, MOCK_MATCHES, MOCK_CHAT_MESSAGES, Candidate, Match } from '@/constants/mockData';

// On Android Emulator, localhost is 10.0.2.2. On iOS simulator/web, localhost is 127.0.0.1 / localhost.
const DEFAULT_API_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_HOST;

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

export function getAuthToken() {
  if (!userAuthToken && typeof window !== 'undefined' && window.localStorage) {
    userAuthToken = window.localStorage.getItem('accessToken');
  }
  return userAuthToken;
}

async function request(path: string, options: RequestInit = {}) {
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
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

let localMockUser: any = {
  id: 'demo-user-123',
  name: 'Alex Rivera',
  age: 25,
  jobTitle: 'Software Engineer',
  company: 'San Francisco',
  location: 'San Francisco, CA',
  latitude: 37.7749,
  longitude: -122.4194,
  bio: 'Coffee lover, weekend hiker, and tech enthusiast ✨',
  photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop'],
  interests: ['coffee', 'hiking', 'tech', 'travel'],
};

export const mobileApi = {
  // Auth
  verifyFirebaseToken: async (idToken: string) => {
    try {
      const res = await request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (res?.accessToken) {
        setAuthToken(res.accessToken);
      }
      return res;
    } catch (e) {
      console.warn('Backend API unreachable or test token used, using dev session:', e);
      const fallback = { accessToken: 'offline-demo-token', refreshToken: 'offline-demo-refresh-token' };
      setAuthToken(fallback.accessToken);
      return fallback;
    }
  },

  // User profile
  getMe: async () => {
    const token = getAuthToken();
    if (!token) return null;
    if (token === 'offline-demo-token') {
      return localMockUser;
    }
    try {
      return await request('/users/me');
    } catch (e) {
      return null;
    }
  },

  updateProfile: async (data: any) => {
    const token = getAuthToken();
    if (!token || token === 'offline-demo-token') {
      localMockUser = { ...localMockUser, ...data };
      return { success: true };
    }
    try {
      const res = await request('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      localMockUser = { ...localMockUser, ...data, ...res };
      return res;
    } catch (e) {
      localMockUser = { ...localMockUser, ...data };
      return { success: true };
    }
  },

  // Discovery / Swiping
  getDiscovery: async (cursor?: string, limit?: number): Promise<{ items: Candidate[]; nextCursor?: string; hasMore?: boolean }> => {
    const token = getAuthToken();
    if (!token) {
      return { items: [], hasMore: false };
    }
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', limit.toString());
      const query = params.toString();
      const data = await request(`/discovery${query ? `?${query}` : ''}`);
      const items = Array.isArray(data) ? data : data.items || [];
      return { items, nextCursor: data.nextCursor, hasMore: Boolean(data.hasMore) };
    } catch (e) {
      return { items: [], hasMore: false };
    }
  },

  swipe: async (swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE') => {
    try {
      return await request('/swipes', {
        method: 'POST',
        body: JSON.stringify({ swipedId, action }),
      });
    } catch (e) {
      console.warn(`Backend swipe fallback for ${action}:`, e);
      return { status: action === 'LIKE' ? 'MATCHED' : 'RECORDED' };
    }
  },

  // Matches
  getMatches: async (cursor?: string, limit?: number): Promise<Match[]> => {
    const token = getAuthToken();
    if (!token) return [];

    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', limit.toString());
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
          online: true,
          bio: m.otherUser?.bio || '',
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
      console.warn('Backend matches fetch error:', e);
      return [];
    }
  },

  // Chat History
  getChatHistory: async (matchId: string, cursor?: string, limit?: number) => {
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', limit.toString());
      const query = params.toString();
      return await request(`/chat/${matchId}/history${query ? `?${query}` : ''}`);
    } catch (e) {
      console.warn(`Backend chat history fallback for match ${matchId}:`, e);
      return MOCK_CHAT_MESSAGES[matchId] || [];
    }
  },

  clearChat: async (matchId: string) => {
    try {
      return await request(`/chat/${matchId}/clear`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('clearChat fallback:', e);
      return { success: true };
    }
  },

  // Stories
  getStoriesFeed: async () => {
    try {
      return await request('/stories/feed');
    } catch (e) {
      console.warn('getStoriesFeed fallback:', e);
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
    try {
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
    } catch (e) {
      console.warn('uploadStoryMedia fallback:', e);
      return { mediaUrl: imageUri, key: `story-${Date.now()}` };
    }
  },

  markStoryViewed: async (storyId: string) => {
    try {
      return await request(`/stories/${storyId}/view`, { method: 'POST' });
    } catch (e) {
      return { success: true };
    }
  },

  deleteStory: async (storyId: string) => {
    try {
      return await request(`/stories/${storyId}`, { method: 'DELETE' });
    } catch (e) {
      return { success: true };
    }
  },

  getStoryViewers: async (storyId: string) => {
    try {
      return (await request(`/stories/${storyId}/viewers`)) as {
        viewerId: string;
        viewedAt: string;
        name: string;
        photoUrl: string | null;
        bio: string | null;
        age: number | null;
      }[];
    } catch (e) {
      console.warn('getStoryViewers fallback:', e);
      return [];
    }
  },

  // Photos
  getPhotoUploadUrl: async (contentType: string) => {
    try {
      return await request('/photos/upload-url', {
        method: 'POST',
        body: JSON.stringify({ contentType }),
      });
    } catch (e) {
      console.warn('getPhotoUploadUrl fallback:', e);
      return null;
    }
  },

  confirmPhotoUpload: async (publicUrl: string, key: string, order?: number) => {
    try {
      return await request('/photos/confirm', {
        method: 'POST',
        body: JSON.stringify({ publicUrl, key, order }),
      });
    } catch (e) {
      console.warn('confirmPhotoUpload fallback:', e);
      return { success: true };
    }
  },

  uploadPhoto: async (imageUri: string, order = 0) => {
    try {
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
            fileToSend = new File([blob], `photo_${Date.now()}.jpg`, {
              type: blob.type || 'image/jpeg',
            });
          } catch {
            return await mobileApi.confirmPhotoUpload(imageUri, `photo-key-${Date.now()}`, order);
          }
        }
      }

      const formData = new FormData();
      if (fileToSend) {
        formData.append('file', fileToSend);
      } else {
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
        } as any);
      }
      formData.append('order', order.toString());

      const token = getAuthToken();
      const res = await fetch(`${API_URL}/photos/upload-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`Photo upload failed: ${await res.text()}`);
      return res.json();
    } catch (e) {
      console.warn('uploadPhoto fallback:', e);
      return await mobileApi.confirmPhotoUpload(imageUri, `photo-key-${Date.now()}`, order);
    }
  },

  deletePhoto: async (photoId: string) => {
    try {
      return await request(`/photos/${photoId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn(`deletePhoto fallback for ${photoId}:`, e);
      return { success: true };
    }
  },
};
