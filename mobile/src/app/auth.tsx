import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, needsOnboarding } from '@/context/AuthContext';

export default function AuthScreen() {
  const router = useRouter();
  const {
    loginWithPhone,
    verifyOtp,
    refreshUser,
  } = useAuth();

  // Login step: 'phone' | 'otp'
  const [loginStep, setLoginStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string>('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset login state to phone step whenever this screen comes into focus (e.g. after sign out)
  useFocusEffect(
    useCallback(() => {
      setLoginStep('phone');
      setPhone('');
      setOtp('');
      setError('');
      setLoading(false);
    }, [])
  );

  // HANDLERS
  async function handleSendOtp() {
    if (!phone || phone.trim().length < 5) {
      setError('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const normalizedPhone = phone.replace(/\s/g, '');
      const res: any = await loginWithPhone(normalizedPhone);
      if (res?.devOtp) {
        setDevOtp(res.devOtp);
      }
      setLoginStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.trim().length < 4) {
      setError('Please enter a valid verification code');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const normalizedPhone = phone.replace(/\s/g, '');
      await verifyOtp(otp.trim(), normalizedPhone);
      const updatedUser = await refreshUser();
      if (needsOnboarding(updatedUser)) {
        router.replace('/onboarding');
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickSocialLogin() {
    setLoading(true);
    setError('');
    try {
      await loginWithPhone('+919876543210');
      await verifyOtp('123456');
      const updatedUser = await refreshUser();
      if (needsOnboarding(updatedUser)) {
        router.replace('/onboarding');
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.message || 'Social sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar with Back Button when in OTP Step */}
      <View style={styles.topHeader}>
        {loginStep === 'otp' && (
          <TouchableOpacity
            style={styles.iconBackBtn}
            onPress={() => {
              setLoginStep('phone');
              setError('');
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandHero}>
          <View style={styles.flameIconCircle}>
            <Ionicons name="flame" size={40} color="#f43f5e" />
          </View>
          <Text style={styles.brandTitle}>Welcome to Lovora</Text>
          <Text style={styles.brandSubtitle}>Enter your +91 mobile number to sign in or register.</Text>
        </View>

        {/* Login Card */}
        <View style={styles.glassCard}>
          {loginStep === 'phone' ? (
            <>
              <View style={styles.phoneInputGroup}>
                <TextInput
                  style={styles.phoneInputField}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#71717a"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (error) setError('');
                  }}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, (!phone || loading) && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading || !phone}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Send SMS code</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerBox}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>OR SIGN IN WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialButtonsRow}>
                <TouchableOpacity style={styles.socialAuthBtn} onPress={handleQuickSocialLogin}>
                  <Ionicons name="logo-apple" size={20} color="#ffffff" />
                  <Text style={styles.socialAuthBtnText}>Apple</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialAuthBtn} onPress={handleQuickSocialLogin}>
                  <Ionicons name="logo-google" size={20} color="#ffffff" />
                  <Text style={styles.socialAuthBtnText}>Google</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.otpHeading}>Enter 6-digit SMS verification code</Text>
              <Text style={styles.otpSubtext}>
                Sent via SMS to {phone || '+91 98765 43210'}
              </Text>

              {/* Dev Test OTP helper box */}
              <TouchableOpacity
                style={styles.devOtpBox}
                activeOpacity={0.8}
                onPress={() => {
                  setOtp(devOtp || '123456');
                  if (error) setError('');
                }}
              >
                <View style={styles.devOtpHeader}>
                  <Ionicons name="flask-outline" size={16} color="#f43f5e" />
                  <Text style={styles.devOtpLabel}>Test Verification Code:</Text>
                  <View style={styles.devOtpBadge}>
                    <Text style={styles.devOtpCode}>{devOtp || '123456'}</Text>
                  </View>
                </View>
                <Text style={styles.devOtpAction}>Tap to auto-fill code</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.otpInputField}
                placeholder="6-digit code"
                placeholderTextColor="#71717a"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(val) => {
                  setOtp(val);
                  if (error) setError('');
                }}
              />

              <TouchableOpacity
                style={[styles.primaryActionBtn, (otp.length < 4 || loading) && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 4}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Verify & continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendCodeLink}
                onPress={handleSendOtp}
                disabled={loading}
              >
                <Text style={styles.resendCodeText}>Didn't receive code? Resend SMS</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  topHeader: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconBackBtn: {
    padding: 6,
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHero: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  flameIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 6,
    textAlign: 'center',
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  phoneInputGroup: {
    marginBottom: 16,
  },
  phoneInputField: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  primaryActionBtn: {
    backgroundColor: '#f43f5e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272a',
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialAuthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27272a',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  socialAuthBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  otpHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  otpSubtext: {
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 16,
  },
  devOtpBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  devOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devOtpLabel: {
    fontSize: 12,
    color: '#d4d4d8',
    fontWeight: '500',
  },
  devOtpBadge: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  devOtpCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
  },
  devOtpAction: {
    fontSize: 11,
    color: '#f43f5e',
    fontWeight: '600',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  otpInputField: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: 16,
  },
  resendCodeLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendCodeText: {
    fontSize: 13,
    color: '#f43f5e',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#f87171',
    marginTop: 14,
    textAlign: 'center',
  },
});
