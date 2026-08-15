'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, isOnboarded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (isOnboarded) {
        router.replace('/discover');
      }
    }
  }, [loading, isAuthenticated, isOnboarded, router]);

  if (loading || !isAuthenticated || isOnboarded) {
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
