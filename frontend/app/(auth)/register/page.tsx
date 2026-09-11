'use client';

import { Suspense } from 'react';
import LoginPage from '../login/page';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-sm">Loading Lovora...</div>}>
      <LoginPage />
    </Suspense>
  );
}
