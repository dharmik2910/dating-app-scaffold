import React, { createContext, useContext, useState, useEffect } from 'react';
import { mobileApi, setAuthToken, getAuthToken, loadStoredAuthToken } from '@/services/api';

export interface UserProfile {
  id?: string;
  name?: string;
  age?: number;
  dob?: string;
  gender?: string;
  interestedIn?: string[];
  jobTitle?: string;
  company?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  bio?: string;
  photos?: (string | { id?: string; url?: string })[];
  interests?: string[];
  profile?: {
    id?: string;
    userId?: string;
    name?: string;
    dob?: string;
    gender?: string;
    bio?: string;
    interestedIn?: string[];
    latitude?: number | null;
    longitude?: number | null;
    minAge?: number;
    maxAge?: number;
    maxDistanceKm?: number;
  } | null;
}

export function needsOnboarding(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const profile = user.profile;
  const name = profile?.name || user.name;
  const lat = profile?.latitude ?? user.latitude;
  const lng = profile?.longitude ?? user.longitude;
  return !name || name.trim() === '' || lat == null || lng == null;
}

interface AuthContextType {
  isReady: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  user: UserProfile | null;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  loginWithPhone: (phone: string) => Promise<any>;
  verifyOtp: (code: string, phoneOverride?: string) => Promise<boolean>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [user, setUser] = useState<UserProfile | null>(null);

  const isOnboarded = isAuthenticated && !needsOnboarding(user);

  const refreshUser = async (): Promise<UserProfile | null> => {
    try {
      let token = getAuthToken();
      if (!token) {
        token = await loadStoredAuthToken();
      }
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return null;
      }
      const remoteUser = await mobileApi.getMe();
      if (remoteUser) {
        setUser(remoteUser);
        setIsAuthenticated(true);
        return remoteUser;
      }
    } catch (e) {
      console.warn('refreshUser error:', e);
    }
    return user;
  };

  useEffect(() => {
    // Attempt restoring saved session from AsyncStorage on app launch
    (async () => {
      try {
        const savedToken = await loadStoredAuthToken();
        if (savedToken) {
          const remoteUser = await mobileApi.getMe();
          if (remoteUser) {
            setUser(remoteUser);
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.warn('Initial session restore error:', err);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  async function loginWithPhone(phone: string): Promise<any> {
    const cleanPhone = phone.trim();
    setPhoneNumber(cleanPhone);
    try {
      const res = await mobileApi.sendOtp(cleanPhone);
      return res;
    } catch (e: any) {
      console.warn('sendOtp error:', e);
      throw e;
    }
  }

  async function verifyOtp(code: string, phoneOverride?: string): Promise<boolean> {
    const targetPhone = (phoneOverride || phoneNumber || '').trim();
    if (targetPhone && targetPhone !== phoneNumber) {
      setPhoneNumber(targetPhone);
    }
    const res = await mobileApi.verifyOtp(targetPhone, code);
    if (res?.accessToken) {
      await setAuthToken(res.accessToken);
    }

    setIsAuthenticated(true);
    const remoteUser = await mobileApi.getMe();
    if (remoteUser) {
      setUser(remoteUser);
    } else if (res?.user) {
      setUser(res.user);
    }
    return true;
  }

  async function completeOnboarding(data: Partial<UserProfile>) {
    const updatedProfile = {
      ...(user?.profile || {}),
      name: data.name || user?.name || user?.profile?.name,
      dob: data.dob || (user as any)?.dob || (user?.profile as any)?.dob,
      gender: data.gender || user?.gender || (user?.profile as any)?.gender,
      bio: data.bio !== undefined ? data.bio : (user?.bio || (user?.profile as any)?.bio),
      interestedIn: data.interestedIn || user?.interestedIn || (user?.profile as any)?.interestedIn,
      latitude: data.latitude ?? user?.latitude ?? user?.profile?.latitude,
      longitude: data.longitude ?? user?.longitude ?? user?.profile?.longitude,
    };

    const updatedUser: UserProfile = {
      ...(user || {}),
      ...data,
      profile: updatedProfile,
    };

    setUser(updatedUser);
    setIsAuthenticated(true);

    try {
      await mobileApi.updateProfile(data);
      const refreshed = await mobileApi.getMe();
      if (refreshed) {
        setUser(refreshed);
      }
    } catch (e) {
      console.warn('Backend updateProfile fallback:', e);
    }
  }

  async function logout() {
    await setAuthToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setPhoneNumber('');
  }

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated,
        isOnboarded,
        user,
        phoneNumber,
        setPhoneNumber,
        loginWithPhone,
        verifyOtp,
        completeOnboarding,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

