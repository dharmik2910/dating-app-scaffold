'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { needsOnboarding } from '@/lib/auth';

interface AuthContextType {
  user: any;
  loading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  refreshUser: () => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isOnboarded: false,
  refreshUser: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const userData = await api.getMe();
      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(user);
  const isOnboarded = Boolean(user && !needsOnboarding(user));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        isOnboarded,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
