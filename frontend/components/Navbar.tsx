'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconFlame,
  IconCompass,
  IconHeart,
  IconUser,
  IconLogout,
  IconMessages,
  IconBell,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { useChatStore } from '@/lib/useChatStore';
import NotificationModal from '@/components/NotificationModal';

type NavbarProps = {
  user?: any;
};

export default function Navbar({ user: propUser }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user: authUser } = useAuth();
  const user = propUser ?? authUser;
  const unreadMatchIds = useChatStore((state) => state.unreadMatchIds);
  const unreadCount = unreadMatchIds.length;

  const [isVisible, setIsVisible] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? Math.max(0, window.scrollY) : 0;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = Math.max(0, window.scrollY);
          const diff = currentScrollY - lastScrollY;

          if (currentScrollY <= 15) {
            setIsVisible(true);
          } else if (diff > 3 && currentScrollY > 40) {
            setIsVisible(false);
          } else if (diff < 0) {
            setIsVisible(true);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      name: 'Chats',
      href: '/chat',
      icon: IconMessages,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: IconUser,
    },
  ];

  return (
    <>
      {/* Top Navbar (Desktop only - Fixed to viewport top) */}
      <header
        className={`hidden lg:block fixed top-0 left-0 right-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8">
          <Link href="/discover" className="flex items-center gap-2 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-ember to-rose-400 text-white shadow-lg shadow-ember/20 group-hover:scale-105 transition-transform">
              <IconFlame size={22} className="fill-white stroke-white" />
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
              Spark
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-ember' : 'text-neutral-400'} />
                  <span>{item.name}</span>
                  {item.badge != null && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-500 text-white rounded-full leading-none shadow-md shadow-rose-500/40 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Icons & Admin Panel */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-900 transition-colors border border-neutral-800"
              title="Notifications"
            >
              <IconBell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            {/* Admin Panel Link (Only visible to Admin phone 9924662647) */}
            {user?.phone && user.phone.includes('9924662647') && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/30"
                title="Admin Panel"
              >
                <IconShieldCheck size={16} />
                <span>Admin</span>
              </Link>
            )}

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
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur-lg px-6 py-2 transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                  isActive ? 'text-ember font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="relative">
                  <Icon size={22} />
                  {item.badge != null && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Global Notification Modal */}
      <NotificationModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
