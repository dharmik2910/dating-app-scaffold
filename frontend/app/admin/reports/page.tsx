'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ReportItem {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: {
    phone: string;
    profile: { name: string; gender: string } | null;
  };
  reported: {
    id: string;
    phone: string;
    isBanned?: boolean;
    banReason?: string | null;
    profile: { name: string; bio: string } | null;
    photos: { id: string; url: string }[];
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminReports(statusFilter === 'ALL' ? undefined : statusFilter);
      if (Array.isArray(data)) {
        setReports(data);
      }
    } catch (e) {
      console.warn('Fetch reports error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId: string, status: string) => {
    setActionLoadingId(reportId);
    try {
      await api.updateAdminReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r)),
      );
    } catch (e: any) {
      alert(e.message || 'Could not update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBanReportedUser = async (report: ReportItem) => {
    if (!confirm(`Are you sure you want to review and APPROVE banning ${report.reported?.profile?.name || 'this user'}?\n\nNote: The user will be soft-banned (NOT deleted from database). You can check their account details and unban/approve them at any time.`)) {
      return;
    }
    setActionLoadingId(report.id);
    try {
      const banReason = `Report Approved: ${report.reason} - ${report.details || 'Violation of Community Guidelines'}`;
      await api.toggleBanUser(report.reportedId, true, banReason);
      await api.updateAdminReportStatus(report.id, 'RESOLVED');
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status: 'RESOLVED',
                reported: { ...r.reported, isBanned: true, banReason },
              }
            : r,
        ),
      );
      alert('Report approved. User has been soft-banned (account preserved in database for admin review & unbanning).');
    } catch (e: any) {
      alert(e.message || 'Could not ban user');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnbanReportedUser = async (report: ReportItem) => {
    if (!confirm(`Are you sure you want to UNBAN & restore ${report.reported?.profile?.name || 'this user'}? They will immediately regain access to discovery and matches.`)) {
      return;
    }
    setActionLoadingId(report.id);
    try {
      await api.toggleBanUser(report.reportedId, false);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                reported: { ...r.reported, isBanned: false, banReason: null },
              }
            : r,
        ),
      );
      alert('User has been unbanned and restored.');
    } catch (e: any) {
      alert(e.message || 'Could not unban user');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Safety & Moderation Queue</h2>
          <p className="text-sm text-zinc-400">
            Reports submitted by users are queued here for admin review. Users are NOT removed; admins check evidence and approve bans or unban anytime.
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors self-start md:self-auto border border-zinc-700/50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 self-start inline-flex">
        {['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED', 'ALL'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === s
                ? 'bg-rose-500 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Loading complaints...</div>
      ) : reports.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-center text-zinc-400">
          <p className="text-3xl mb-2">🛡️</p>
          <p className="font-bold text-white text-base">No Reports in this Queue</p>
          <p className="text-xs text-zinc-500 mt-1">Community standards are currently intact.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reports.map((r) => {
            const reportedPhotos = r.reported?.photos || [];
            return (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-lg"
              >
                {/* Top Badge & Date */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-400 uppercase tracking-wider">
                    ⚠️ {r.reason.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Reporter & Reported Info Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                      Reporter
                    </span>
                    <strong className="text-zinc-200">
                      {r.reporter?.profile?.name || 'User'}
                    </strong>
                    <p className="text-zinc-500">{r.reporter?.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                      Reported Account
                    </span>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-rose-400 font-bold">
                        {r.reported?.profile?.name || 'Unknown'}
                      </strong>
                      {r.reported?.isBanned && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500">{r.reported?.phone}</p>
                  </div>
                </div>

                {/* Reported Photos Preview */}
                {reportedPhotos.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1.5">
                      Reported User Photos
                    </span>
                    <div className="flex gap-2">
                      {reportedPhotos.slice(0, 3).map((p, i) => (
                        <img
                          key={i}
                          src={p.url}
                          alt="reported photo"
                          className="w-16 h-20 rounded-lg object-cover border border-zinc-700"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Details note */}
                {r.details && (
                  <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/40 text-xs text-zinc-300 italic">
                    &ldquo;{r.details}&rdquo;
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                  {r.reported?.isBanned ? (
                    <button
                      onClick={() => handleUnbanReportedUser(r)}
                      disabled={actionLoadingId === r.id}
                      className="flex-1 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Unban User 🟢
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBanReportedUser(r)}
                      disabled={actionLoadingId === r.id || r.status === 'RESOLVED'}
                      className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Approve & Ban User 🚫
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus(r.id, 'DISMISSED')}
                    disabled={actionLoadingId === r.id}
                    className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(r.id, 'REVIEWED')}
                    disabled={actionLoadingId === r.id}
                    className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Mark Reviewed
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
