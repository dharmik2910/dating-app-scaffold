'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import Navbar from '@/components/Navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, isAuthenticated, isOnboarded } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (!isOnboarded) {
        router.replace('/setup');
      }
    }
  }, [loading, isAuthenticated, isOnboarded, router]);

  if (loading || !isAuthenticated || !isOnboarded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-ember border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm font-medium">Loading Spark...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 pb-16 lg:pb-0">
      <Navbar user={user} />
      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}


