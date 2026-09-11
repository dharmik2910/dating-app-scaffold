'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getPostAuthPath } from '@/lib/auth';
import { useAuth } from '@/components/AuthContext';
import { IconFlame, IconPhone, IconShieldCheck, IconArrowLeft } from '@tabler/icons-react';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India (+91)' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada (+1)' },
  { code: '+44', flag: '🇬🇧', label: 'UK (+44)' },
  { code: '+971', flag: '🇦🇪', label: 'UAE (+971)' },
  { code: '+61', flag: '🇦🇺', label: 'Australia (+61)' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore (+65)' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const { refreshUser } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string>('123456');

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

    const formatted = fullPhone;
    if (formatted.length < 8) {
      setError('Please enter a valid mobile number');
      setLoading(false);
      return;
    }

    try {
      // Direct NestJS Backend -> SMS OTP
      const res = await api.sendOtp(formatted);
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
      } else {
        setDevOtp('123456');
      }
      setStep('otp');
      setResendTimer(30);
    } catch (e: any) {
      setError(e.message || 'Failed to send SMS OTP. Please check your mobile number.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Direct NestJS Backend -> AWS SNS OTP Verification & User Login/Create
      const res = await api.verifyOtp(fullPhone, otp);
      if (res?.accessToken) {
        localStorage.setItem('accessToken', res.accessToken);
      }
      if (res?.refreshToken) {
        localStorage.setItem('refreshToken', res.refreshToken);
      }
      const user = await refreshUser();
      router.push(getPostAuthPath(user));
    } catch (e: any) {
      setError(e.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-8 text-white overflow-hidden selection:bg-rose-500/30">
      {/* Premium ambient gradient lighting */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-600/20 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-orange-600/15 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full bg-rose-500/5 blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-neutral-800/80 bg-neutral-900/70 p-7 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 via-pink-600 to-orange-500 shadow-lg shadow-rose-600/30 ring-1 ring-white/20">
            <IconFlame size={34} className="fill-white stroke-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            {mode === 'login' ? 'Welcome to Lovora' : 'Create Lovora Account'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-400">
            {step === 'phone'
              ? mode === 'login'
                ? 'Sign in with your +91 mobile number to continue'
                : 'Enter your +91 mobile number to create your profile'
              : `Enter the 6-digit SMS verification code sent to ${fullPhone}`}
          </p>
        </div>

        {/* Tab Toggle between Sign In and Create Account (when in phone step) */}
        {step === 'phone' && (
          <div className="flex p-1 mb-6 bg-neutral-950/80 border border-neutral-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {step === 'phone' ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <IconPhone size={14} className="text-rose-400" />
                <span>Mobile Number</span>
              </label>
              <div className="flex gap-2">
                {/* Country Selector */}
                <div className="relative shrink-0">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-12 appearance-none rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 pr-7 text-xs font-semibold text-neutral-200 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">
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
                  className="h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 text-sm font-medium text-white placeholder-neutral-600 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all tracking-wide"
                />
              </div>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || phoneDigits.length < 6}
              className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-xs font-semibold">Sending SMS OTP...</span>
                </div>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider">
                  {mode === 'login' ? 'Get SMS OTP →' : 'Send Verification OTP →'}
                </span>
              )}
            </button>

            {/* Privacy note */}
            <p className="text-[11px] text-center text-neutral-500 leading-relaxed pt-2">
              By continuing, you agree to Lovora's{' '}
              <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Terms</span> and{' '}
              <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Privacy Policy</span>. We will send a one-time SMS verification code to your phone.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dev Test OTP Box for quick testing */}
            <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-orange-500/10 p-3.5 text-center shadow-inner">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-rose-300">
                <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                <span className="text-neutral-300">Test Verification Code:</span>
                <span className="font-mono text-base font-extrabold text-white tracking-widest bg-neutral-900/90 px-3 py-0.5 rounded-lg border border-rose-500/50 shadow-sm">
                  {devOtp || '123456'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOtp(devOtp || '123456');
                  setError('');
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-200 transition-colors cursor-pointer underline underline-offset-2"
              >
                ✨ Click to auto-fill code ({devOtp || '123456'})
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-center block text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-center gap-1.5">
                <IconShieldCheck size={15} className="text-rose-400" />
                <span>6-Digit Verification Code</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length >= 4 && handleVerifyOtp()}
                className="h-14 w-full rounded-xl border border-neutral-800 bg-neutral-950/80 text-center font-mono text-2xl font-bold tracking-[0.35em] text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-neutral-700"
              />
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-orange-500 font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-xs font-semibold">Verifying code...</span>
                </div>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider">
                  {mode === 'login' ? 'Verify & Sign In' : 'Verify & Create Account'}
                </span>
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
                className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <IconArrowLeft size={13} />
                <span>Change number</span>
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || loading}
                onClick={handleSendOtp}
                className="font-medium text-rose-400 hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {resendTimer > 0 ? `Resend SMS (${resendTimer}s)` : 'Resend SMS code'}
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
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-sm">Loading Lovora...</div>}>
      <LoginForm />
    </Suspense>
  );
}
