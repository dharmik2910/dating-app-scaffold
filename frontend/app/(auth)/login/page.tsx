'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtp } from '@/lib/firebase';
import { api } from '@/lib/api';
import { getPostAuthPath } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore' },
];

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');

  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devMessage, setDevMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const fullPhone = `${countryCode}${phoneDigits.replace(/\D/g, '')}`;

  async function handleSendOtp() {
    setLoading(true);
    setError('');
    setDevMessage('');

    const formatted = fullPhone;
    if (formatted.length < 8) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    try {
      // 1. Attempt standard Firebase SMS OTP
      if (recaptchaRef.current) {
        try {
          const result = await requestOtp(formatted, recaptchaRef.current);
          setConfirmationResult(result);
          setStep('otp');
          setResendTimer(30);
          setLoading(false);
          return;
        } catch (fbErr: any) {
          console.warn('Firebase SMS request fallback:', fbErr);
        }
      }

      // 2. Dev / Backend fallback (allows 123456 dev test OTP code)
      const res = await api.sendWhatsappOtp(formatted);
      setConfirmationResult(null);
      setStep('otp');
      setResendTimer(30);
      setDevMessage(res.devOtpCode ? `Dev Test Code: ${res.devOtpCode} (or enter 123456)` : 'Code sent! Use test code 123456');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let accessToken = '';
      let refreshToken = '';

      // Support 123456 dev test code or fallback backend OTP
      if (!confirmationResult || otp === '123456' || otp === '000000') {
        const res = await api.verifyWhatsappOtp(fullPhone, otp);
        accessToken = res.accessToken;
        refreshToken = res.refreshToken;
      } else {
        try {
          const credential = await confirmationResult.confirm(otp);
          const idToken = await credential.user.getIdToken();
          const res = await api.verifyFirebaseToken(idToken);
          accessToken = res.accessToken;
          refreshToken = res.refreshToken;
        } catch (fbVerifyErr: any) {
          // Fallback to backend verification for 123456 or test codes
          const res = await api.verifyWhatsappOtp(fullPhone, otp);
          accessToken = res.accessToken;
          refreshToken = res.refreshToken;
        }
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      const user = await refreshUser();
      router.push(getPostAuthPath(user));
    } catch (e: any) {
      setError(e.message || 'Invalid code. Try test code 123456');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white overflow-hidden selection:bg-rose-500/30">
      {/* Premium ambient gradient lighting */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-neutral-800/80 bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-2xl transition-all">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 via-pink-600 to-orange-500 shadow-lg shadow-rose-600/30 ring-1 ring-white/20">
            <span className="text-3xl">🔥</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            Welcome to Ember
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {step === 'phone'
              ? 'Enter your mobile number to sign in or create an account'
              : `Enter the 6-digit code sent to ${fullPhone}`}
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Phone Number
              </label>
              <div className="flex gap-2">
                {/* Country Selector */}
                <div className="relative">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-12 appearance-none rounded-xl border border-neutral-800 bg-neutral-950/80 px-3.5 pr-8 text-sm font-medium text-neutral-200 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                    ▼
                  </span>
                </div>

                {/* Phone Input */}
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && phoneDigits && handleSendOtp()}
                  className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 text-base font-medium text-white placeholder-neutral-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all tracking-wide"
                />
              </div>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || phoneDigits.length < 6}
              className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Sending code...</span>
                </div>
              ) : (
                <span>Continue →</span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dev hint badge */}
            {devMessage && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-medium text-amber-300 shadow-inner">
                {devMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-center block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length >= 4 && handleVerifyOtp()}
                className="h-14 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 text-center font-mono text-3xl font-bold tracking-[0.4em] text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-neutral-700 placeholder:tracking-normal placeholder:font-sans placeholder:text-lg"
              />
              <p className="text-center text-[11px] text-neutral-500">
                Tip: You can use test code <strong className="text-neutral-300 font-mono">123456</strong>
              </p>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Verifying...</span>
                </div>
              ) : (
                <span>Verify & Login</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                ← Edit phone number
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || loading}
                onClick={handleSendOtp}
                className="font-medium text-rose-400 hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs font-medium text-red-300 animate-fade-in">
            {error}
          </div>
        )}

        <div ref={recaptchaRef} />
      </div>
    </main>
  );
}
