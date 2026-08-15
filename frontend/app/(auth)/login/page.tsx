'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtp } from '@/lib/firebase';
import { api } from '@/lib/api';
import { getPostAuthPath } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp() {
    if (!recaptchaRef.current) return;

    setLoading(true);
    setError('');
    try {
      const normalizedPhone = phone.replace(/\s/g, '');
      const result = await requestOtp(normalizedPhone, recaptchaRef.current);
      setConfirmationResult(result);
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setLoading(true);
    setError('');
    try {
      const credential = await confirmationResult.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const { accessToken, refreshToken } = await api.verifyFirebaseToken(idToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      const user = await refreshUser();
      router.push(getPostAuthPath(user));
    } catch (e: any) {
      setError(e.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Ember</h1>
        <p className="text-neutral-400 text-sm">Sign in with your phone number to continue.</p>

        {!confirmationResult ? (
          <div className="space-y-3">
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-ember"
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !phone}
              className="w-full rounded-lg bg-ember hover:bg-ember-dark transition-colors py-3 font-medium disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:border-ember tracking-widest text-center text-lg"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="w-full rounded-lg bg-ember hover:bg-ember-dark transition-colors py-3 font-medium disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & continue'}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div ref={recaptchaRef} />
      </div>
    </main>
  );
}
