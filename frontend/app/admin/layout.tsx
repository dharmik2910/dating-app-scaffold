'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { IconShieldLock, IconArrowLeft, IconUsers, IconChartBar, IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react';

const ADMIN_PHONE = '9924662647';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview & KPIs', icon: IconChartBar },
  { href: '/admin/users', label: 'User Management', icon: IconUsers },
  { href: '/admin/reports', label: 'Moderation Queue', icon: IconAlertTriangle },
  { href: '/admin/safe-dates', label: 'Safe Date Hub', icon: IconShieldCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Restrict to admin phone (e.g. 9924662647) or development
  const userPhoneDigits = (user?.phone || '').replace(/\D/g, '');
  const adminPhoneDigits = ADMIN_PHONE.replace(/\D/g, '');
  const isAdmin = Boolean(
    userPhoneDigits.includes(adminPhoneDigits) ||
      (userPhoneDigits.length >= 10 && userPhoneDigits.endsWith(adminPhoneDigits)) ||
      process.env.NODE_ENV === 'development',
  );

  if (!isAdmin) {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <IconShieldLock size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Access Denied</h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              This admin panel is restricted exclusively to authorized administrators ({ADMIN_PHONE}).
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-95 font-bold text-xs text-white shadow-lg transition-all"
          >
            <IconArrowLeft size={16} />
            <span>Return to App</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/70 backdrop-blur-md flex flex-col justify-between p-5 shrink-0 h-full select-none z-30">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-8 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-rose-500/20">
              E
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-wider">EMBER ADMIN</h1>
              <p className="text-[10px] text-zinc-400 font-medium">Admin: {user?.phone || ADMIN_PHONE}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isActive
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-rose-400' : 'text-zinc-400'} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Admin Privileges Active
          </div>

          <Link
            href="/discover"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-colors border border-zinc-700/60"
          >
            ← Back to Dating App
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto bg-gradient-to-b from-zinc-900/30 via-zinc-950 to-zinc-950 p-6 sm:p-8">
        {children}
      </main>
    </div>
  );
}
