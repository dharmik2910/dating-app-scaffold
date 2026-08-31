import React, { createContext, useContext, useState, useEffect } from 'react';
import { CURRENT_USER } from '@/constants/mockData';
import { mobileApi, setAuthToken } from '@/services/api';

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
  photos?: string[];
  interests?: string[];
  profile?: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export function needsOnboarding(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const profile = user.profile;
  const name = profile?.name || user.name;
  const lat = profile?.latitude ?? user.latitude;
  const lng = profile?.longitude ?? user.longitude;
  return !name || lat == null || lng == null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isOnboarded: boolean;
  user: UserProfile | null;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  loginWithPhone: (phone: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  completeOnboarding: (data: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [user, setUser] = useState<UserProfile | null>(null);

  const isOnboarded = isAuthenticated && !needsOnboarding(user);

  const refreshUser = async (): Promise<UserProfile | null> => {
    try {
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
    // Attempt fetching current logged-in user on app launch
    refreshUser();
  }, []);

  async function loginWithPhone(phone: string): Promise<boolean> {
    setPhoneNumber(phone);
    return true;
  }

  async function verifyOtp(code: string): Promise<boolean> {
    try {
      const res = await mobileApi.verifyFirebaseToken(code);
      if (res?.accessToken) {
        setAuthToken(res.accessToken);
      }
    } catch (e) {
      console.warn('verifyOtp error fallback:', e);
    }

    setIsAuthenticated(true);
    if (!user) {
      setUser({
        id: 'user-me',
        name: '',
        age: 24,
        bio: '',
        photos: [],
      });
    }
    return true;
  }

  async function completeOnboarding(data: Partial<UserProfile>) {
    const updatedUser = {
      ...(user || {}),
      ...data,
    };
    setUser(updatedUser as UserProfile);
    setIsAuthenticated(true);

    try {
      await mobileApi.updateProfile(updatedUser);
      await refreshUser();
    } catch (e) {
      console.warn('Backend updateProfile fallback:', e);
    }
  }

  function logout() {
    setAuthToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setPhoneNumber('');
  }

  return (
    <AuthContext.Provider
      value={{
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
