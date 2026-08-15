'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { IconFlame, IconCompass, IconHeart, IconUser, IconLogout } from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';

type NavbarProps = {
  user?: any;
};

export default function Navbar({ user: propUser }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user: authUser } = useAuth();
  const user = propUser ?? authUser;

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  const navItems = [
    {
      name: 'Discover',
      href: '/discover',
      icon: IconCompass,
    },
    {
      name: 'Matches',
      href: '/matches',
      icon: IconHeart,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: IconUser,
    },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/discover" className="flex items-center gap-2 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-ember to-rose-400 text-white shadow-lg shadow-ember/20 group-hover:scale-105 transition-transform">
              <IconFlame size={22} className="fill-white stroke-white" />
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Spark
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-ember' : 'text-neutral-400'} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Action Profile & Logout */}
          <div className="flex items-center gap-3">
            {user?.profile?.name && (
              <span className="hidden sm:inline text-xs font-medium text-neutral-400">
                Hi, <span className="text-neutral-200">{user.profile.name}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-900 transition-colors border border-neutral-800 hover:border-rose-900/40"
              title="Logout"
            >
              <IconLogout size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur-lg px-6 py-2">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                  isActive ? 'text-ember font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] mt-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
