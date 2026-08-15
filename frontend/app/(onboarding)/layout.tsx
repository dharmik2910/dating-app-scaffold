'use client';

import OnboardingGuard from '@/components/OnboardingGuard';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingGuard>{children}</OnboardingGuard>;
}
