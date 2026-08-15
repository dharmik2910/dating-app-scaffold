'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (isOnboarded) {
        router.replace('/discover');
      } else {
        router.replace('/setup');
      }
    }
  }, [loading, isAuthenticated, isOnboarded, router]);

  if (loading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-ember border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm font-medium">Loading Spark...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
