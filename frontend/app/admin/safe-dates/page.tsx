'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SafeDatePlan {
  id: string;
  userId: string;
  matchId: string;
  contactName: string;
  contactPhone: string;
  locationName: string;
  scheduledTime: string;
  status: string;
  notes: string | null;
  checkedInAt: string | null;
  createdAt: string;
  user: {
    phone: string;
    profile: { name: string } | null;
    photos: { id: string; url: string }[];
  };
  match: {
    user1: { profile: { name: string } | null; photos: { url: string }[] };
    user2: { profile: { name: string } | null; photos: { url: string }[] };
  };
}

export default function AdminSafeDatesPage() {
  const [safeDates, setSafeDates] = useState<SafeDatePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSafeDates();
  }, []);

  const fetchSafeDates = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminSafeDates();
      if (Array.isArray(data)) {
        setSafeDates(data);
      }
    } catch (e) {
      console.warn('Fetch safe dates error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Live Safe Date Monitor</h2>
          <p className="text-sm text-zinc-400">
            Real-time monitoring of user date check-ins, designated venues, and emergency contact details.
          </p>
        </div>
        <button
          onClick={fetchSafeDates}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors self-start md:self-auto border border-zinc-700/50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Loading date plans...</div>
      ) : safeDates.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-center text-zinc-400">
          <p className="text-3xl mb-2">🛡️</p>
          <p className="font-bold text-white text-base">No Active Date Plans</p>
          <p className="text-xs text-zinc-500 mt-1">Users will see emergency check-in options in chat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {safeDates.map((plan) => {
            const isSafe = plan.status === 'SAFE';
            const isAlert = plan.status === 'ALERT';

            return (
              <div
                key={plan.id}
                className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-lg"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isSafe
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : isAlert
                        ? 'bg-red-500/20 border border-red-500/30 text-red-400 animate-pulse'
                        : 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                    }`}
                  >
                    {isSafe ? '✅ Checked In Safe' : isAlert ? '🚨 Alert Triggered' : '⏳ Date Scheduled'}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(plan.scheduledTime).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Users and Meeting Details */}
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">User:</span>
                    <strong className="text-white">{plan.user?.profile?.name || 'User'} ({plan.user?.phone})</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Venue / Place:</span>
                    <strong className="text-rose-400 font-bold">📍 {plan.locationName}</strong>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">
                    Emergency Contact Registered
                  </span>
                  <div className="flex items-center justify-between text-zinc-200">
                    <strong className="text-white">👤 {plan.contactName}</strong>
                    <span className="text-emerald-400 font-semibold">📞 {plan.contactPhone}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
