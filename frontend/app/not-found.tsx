'use client';

import Link from 'next/link';
import { IconFlame, IconCompass } from '@tabler/icons-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="text-center py-12 px-8 bg-neutral-900/60 border border-neutral-800/80 rounded-3xl max-w-sm w-full shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <IconFlame size={32} className="fill-rose-500/20" />
        </div>

        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1">404</h1>
        <h2 className="text-base font-semibold text-neutral-200 mb-2">Page Not Found</h2>
        <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-6 leading-relaxed">
          The page you are looking for doesn&apos;t exist.
        </p>

        <Link
          href="/discover"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-amber-500 font-semibold text-xs px-6 py-3 rounded-full text-white shadow-lg shadow-rose-500/20 hover:opacity-95 active:scale-95 transition-all"
        >
          <IconCompass size={16} />
          <span>Back to Discover</span>
        </Link>
      </div>
    </main>
  );
}


