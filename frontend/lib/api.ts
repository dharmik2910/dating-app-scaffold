const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
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
  sendWhatsappOtp: (phone: string) =>
    request('/auth/send-whatsapp-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyWhatsappOtp: (phone: string, code: string) =>
    request('/auth/verify-whatsapp-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  verifyFirebaseToken: (idToken: string) =>
    request('/auth/verify', { method: 'POST', body: JSON.stringify({ idToken }) }),
  getMe: () => request('/users/me'),
  updateProfile: (data: unknown) => request('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  getDiscovery: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return request(`/discovery${query ? `?${query}` : ''}`);
  },
  swipe: (swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE' | 'UNLIKE') =>
    request('/swipes', { method: 'POST', body: JSON.stringify({ swipedId, action }) }),
  getMatches: (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', limit.toString());
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
  deletePhoto: (id: string) => request(`/photos/${id}`, { method: 'DELETE' }),
};
