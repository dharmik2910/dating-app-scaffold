const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export const api = {
  verifyFirebaseToken: (idToken: string) =>
    request('/auth/verify', { method: 'POST', body: JSON.stringify({ idToken }) }),
  getMe: () => request('/users/me'),
  updateProfile: (data: unknown) => request('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  getDiscovery: () => request('/discovery'),
  swipe: (swipedId: string, action: 'LIKE' | 'PASS' | 'SUPERLIKE') =>
    request('/swipes', { method: 'POST', body: JSON.stringify({ swipedId, action }) }),
  getMatches: () => request('/matches'),
  getChatHistory: (matchId: string) => request(`/chat/${matchId}/history`),
  getPhotoUploadUrl: (contentType: string) =>
    request('/photos/upload-url', { method: 'POST', body: JSON.stringify({ contentType }) }),
  confirmPhotoUpload: (publicUrl: string, key: string, order?: number) =>
    request('/photos/confirm', { method: 'POST', body: JSON.stringify({ publicUrl, key, order }) }),
  uploadPhoto: async (file: File, order = 0) => {
    try {
      const { uploadUrl, publicUrl, key } = await request('/photos/upload-url', {
        method: 'POST',
        body: JSON.stringify({ contentType: file.type }),
      });
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (putRes.ok) {
        return request('/photos/confirm', {
          method: 'POST',
          body: JSON.stringify({ publicUrl, key, order }),
        });
      }
    } catch (e) {
      console.warn('Presigned upload failed, falling back to direct server upload:', e);
    }

    // Fallback: upload file directly through backend server endpoint
    const formData = new FormData();
    formData.append('file', file);
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
};

