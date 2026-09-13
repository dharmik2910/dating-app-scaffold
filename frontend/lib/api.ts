const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
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
    } catch {
      const text = await res.text().catch(() => '');
      if (text) errorMsg = text;
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

/**
 * Compress images on client-side before network transfer.
 * Converts 5MB-15MB phone camera photos down to ~150KB-300KB JPEGs in milliseconds!
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export const api = {
  sendOtp: (phone: string) =>
    request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  sendWhatsappOtp: (phone: string) =>
    request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyWhatsappOtp: (phone: string, code: string) =>
    request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  verifyFirebaseToken: (idToken: string) =>
    request('/auth/verify', { method: 'POST', body: JSON.stringify({ idToken }) }),
  getMe: () => request('/users/me'),
  updateProfile: (data: unknown) => request('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  getDiscovery: (cursor?: string, limit?: number, q?: string) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    if (q) params.set('q', q);
    const query = params.toString();
    return request(`/discovery${query ? `?${query}` : ''}`);
  },
  swipe: (swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE') =>
    request('/swipes', { method: 'POST', body: JSON.stringify({ swipedId, action }) }),
  getMatches: (cursor?: string, limit?: number, type: 'matches' | 'conversations' | 'all' = 'matches') => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    if (type) params.set('type', type);
    const query = params.toString();
    return request(`/matches${query ? `?${query}` : ''}`);
  },
  getConversations: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    params.set('type', 'conversations');
    const query = params.toString();
    return request(`/matches${query ? `?${query}` : ''}`);
  },
  getChatHistory: (matchId: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return request(`/chat/${matchId}/history${query ? `?${query}` : ''}`);
  },
  clearChat: (matchId: string) =>
    request(`/chat/${matchId}/clear`, { method: 'DELETE' }),
  getPhotoUploadUrl: (contentType: string) =>
    request('/photos/upload-url', { method: 'POST', body: JSON.stringify({ contentType }) }),
  confirmPhotoUpload: (publicUrl: string, key: string, order?: number) =>
    request('/photos/confirm', { method: 'POST', body: JSON.stringify({ publicUrl, key, order }) }),
  uploadPhoto: async (file: File, order = 0) => {
    // 1. Instant client-side compression (reduces payload by up to 95%)
    const fileToUpload = await compressImage(file);

    // 2. Presigned S3 upload with fast fallback
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const { uploadUrl, publicUrl, key } = await request('/photos/upload-url', {
        method: 'POST',
        body: JSON.stringify({ contentType: fileToUpload.type }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileToUpload,
        headers: { 'Content-Type': fileToUpload.type },
      });
      if (putRes.ok) {
        return request('/photos/confirm', {
          method: 'POST',
          body: JSON.stringify({ publicUrl, key, order }),
        });
      }
    } catch (e) {
      console.warn('Presigned S3 upload skipped, proceeding with fast direct server upload:', e);
    }

    // 3. Fast direct backend upload fallback
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('order', order.toString());

    const token = getAccessToken();
    const res = await fetch(`${API_URL}/photos/upload-file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Photo upload failed: ${await res.text()}`);
    return res.json();
  },
  uploadStoryMedia: async (file: File) => {
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      fileToUpload = await compressImage(file);
    }
    const formData = new FormData();
    formData.append('file', fileToUpload);

    const token = getAccessToken();
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
  deletePhoto: (id: string) => request(`/photos/${id}`, { method: 'DELETE' }),
  getStoriesFeed: () => request('/stories/feed'),
  createStory: (mediaUrl: string, mediaType = 'image', caption?: string) =>
    request('/stories', {
      method: 'POST',
      body: JSON.stringify({ mediaUrl, mediaType, caption }),
    }),
  markStoryViewed: (storyId: string) =>
    request(`/stories/${storyId}/view`, { method: 'POST' }),
  getStoryViewers: (storyId: string) =>
    request<{ viewerId: string; viewedAt: string; name: string; photoUrl: string | null; bio: string | null; age: number | null }[]>(`/stories/${storyId}/viewers`),
  deleteStory: (storyId: string) =>
    request(`/stories/${storyId}`, { method: 'DELETE' }),

  // VIP & Swipes Extensions
  getWhoLikedMe: () => request('/swipes/who-liked-me'),
  boostProfile: (durationMinutes = 30) =>
    request('/swipes/boost', { method: 'POST', body: JSON.stringify({ durationMinutes }) }),
  sendCompliment: (receiverId: string, content: string, targetType = 'profile', targetId?: string) =>
    request('/swipes/compliment', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content, targetType, targetId }),
    }),

  // Discovery Modes
  getTopPicks: () => request('/discovery/top-picks'),
  getBlindDateQueue: () => request('/discovery/blind-date'),

  // AI Matching & Icebreakers
  getAiIcebreakers: (targetUserId: string) =>
    request(`/ai/icebreakers/${targetUserId}`, { method: 'POST' }),
  generateAiIcebreakers: (targetUserId: string) =>
    request(`/ai/icebreakers/${targetUserId}`, { method: 'POST' }),
  getAiCompatibility: (targetUserId: string) =>
    request(`/ai/compatibility/${targetUserId}`),
  generateAiBio: (vibe: 'funny' | 'romantic' | 'adventurous' | 'creative' = 'creative') =>
    request('/ai/generate-bio', { method: 'POST', body: JSON.stringify({ vibe }) }),

  // Profile Prompts & Settings
  getProfilePrompts: async () => {
    const res = await request<any>('/users/me');
    return res?.profile?.prompts || [];
  },
  createProfilePrompt: (data: { question: string; answer: string; order?: number }) =>
    request('/users/me/prompts', {
      method: 'POST',
      body: JSON.stringify({ question: data.question, answer: data.answer, order: data.order ?? 0 }),
    }),
  deleteProfilePrompt: (promptId: string) =>
    request(`/users/me/prompts/${promptId}`, { method: 'DELETE' }),
  addOrUpdatePrompt: (question: string, answer: string, order = 0) =>
    request('/users/me/prompts', {
      method: 'POST',
      body: JSON.stringify({ question, answer, order }),
    }),
  deletePrompt: (promptId: string) =>
    request(`/users/me/prompts/${promptId}`, { method: 'DELETE' }),
  setVoiceBio: (voiceBioUrl: string | null) =>
    request('/users/me/voice-bio', { method: 'POST', body: JSON.stringify({ voiceBioUrl }) }),
  getSwipeQuota: () =>
    request<{ remaining: number; isUnlimited: boolean; totalAllowed: number }>('/swipes/quota'),
  updateExtendedProfile: (data: any) =>
    request('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  submitVerification: (selfieUrl: string) =>
    request('/safety/verify-photo', { method: 'POST', body: JSON.stringify({ selfieUrl }) }),
  getPublicProfile: (userId: string) => request(`/users/${userId}`),

  // Safety & Moderation
  blockUser: (blockedId: string) =>
    request('/safety/block', { method: 'POST', body: JSON.stringify({ blockedId }) }),
  unblockUser: (userId: string) =>
    request(`/safety/block/${userId}`, { method: 'DELETE' }),
  getBlockedUsers: () => request('/safety/blocked'),
  reportUser: (reportedIdOrData: string | { reportedUserId?: string; reason: string; notes?: string; details?: string }, reason?: string, details?: string) => {
    if (typeof reportedIdOrData === 'object') {
      return request('/safety/report', {
        method: 'POST',
        body: JSON.stringify({
          reportedId: reportedIdOrData.reportedUserId,
          reason: reportedIdOrData.reason,
          details: reportedIdOrData.notes || reportedIdOrData.details,
        }),
      });
    }
    return request('/safety/report', {
      method: 'POST',
      body: JSON.stringify({ reportedId: reportedIdOrData, reason, details }),
    });
  },
  verifyPhoto: (selfieUrl: string) =>
    request('/safety/verify-photo', { method: 'POST', body: JSON.stringify({ selfieUrl }) }),
  createSafeDate: (data: any) =>
    request('/safety/safe-date', { method: 'POST', body: JSON.stringify(data) }),
  getSafeDates: () => request('/safety/safe-dates'),
  checkInSafeDate: (id: string, status: 'SAFE' | 'ALERT' = 'SAFE') =>
    request(`/safety/safe-date/${id}/checkin`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // In-Chat Date Invites & Ephemeral
  sendDateInvite: (matchId: string, data: any) =>
    request(`/chat/${matchId}/date-invite`, { method: 'POST', body: JSON.stringify(data) }),
  respondDateInvite: (matchId: string, messageId: string, response: string) =>
    request(`/chat/${matchId}/date-invite/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ response: response.toLowerCase() }),
    }),
  viewEphemeralMedia: (matchId: string, messageId: string) =>
    request(`/chat/${matchId}/ephemeral/${messageId}/view`, { method: 'POST' }),

  // Notifications
  registerPushToken: (token: string, platform = 'web') =>
    request('/notifications/token', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  getNotifications: () => request('/notifications'),
  markNotificationAsRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsAsRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),

  // Admin Dashboard Endpoints
  getAdminStats: () => request('/admin/stats'),
  getAdminUsers: (search?: string, verified?: boolean, limit?: number, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (verified !== undefined) params.set('verified', verified.toString());
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return request(`/admin/users${query ? `?${query}` : ''}`);
  },
  toggleVerifyUser: (userId: string, isVerified?: boolean) =>
    request(`/admin/users/${userId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified }),
    }),
  toggleBanUser: (userId: string, isBanned: boolean, banReason?: string) =>
    request(`/admin/users/${userId}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned, banReason }),
    }),
  deleteUser: (userId: string) =>
    request(`/admin/users/${userId}`, { method: 'DELETE' }),
  getAdminReports: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const query = params.toString();
    return request(`/admin/reports${query ? `?${query}` : ''}`);
  },
  updateAdminReportStatus: (reportId: string, status: string) =>
    request(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getAdminSafeDates: () => request('/admin/safe-dates'),
  broadcastAnnouncement: (title: string, body: string, data?: any) =>
    request('/admin/announcement', {
      method: 'POST',
      body: JSON.stringify({ title, body, data }),
    }),
  getAdminStories: () => request('/admin/stories'),
  deleteAdminStory: (storyId: string) =>
    request(`/admin/stories/${storyId}`, { method: 'DELETE' }),
};


