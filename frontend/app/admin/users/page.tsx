'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  IconSearch,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconEye,
  IconX,
  IconUser,
  IconHeart,
  IconFlame,
  IconAlertTriangle,
  IconMapPin,
  IconCheck,
} from '@tabler/icons-react';

interface AdminUser {
  id: string;
  phone: string;
  createdAt: string;
  name: string;
  gender: string;
  bio: string;
  isVerified: boolean;
  isBanned: boolean;
  banReason?: string | null;
  interests: string[];
  passportActive: boolean;
  passportCity: string | null;
  photos: { id: string; url: string }[];
  matchCount: number;
  reportsCount: number;
  swipesCount: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BANNED' | 'VERIFIED'>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers(
        search || undefined,
        statusFilter === 'VERIFIED' ? true : undefined,
        100,
        statusFilter === 'BANNED' ? 'BANNED' : statusFilter === 'ACTIVE' ? 'ACTIVE' : undefined,
      );
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (e) {
      console.warn('Fetch admin users error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleToggleVerify = async (user: AdminUser) => {
    setActionLoadingId(user.id);
    try {
      await api.toggleVerifyUser(user.id, !user.isVerified);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isVerified: !u.isVerified } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) => (prev ? { ...prev, isVerified: !prev.isVerified } : null));
      }
    } catch (e: any) {
      alert(e.message || 'Could not update verification');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleBan = async (user: AdminUser, shouldBan: boolean) => {
    let banReason = 'Violation of Community Guidelines';
    if (shouldBan) {
      const inputReason = window.prompt(
        `Enter reason for BANNING user ${user.name} (${user.phone}):`,
        'Violation of Community Guidelines',
      );
      if (inputReason === null) return; // Cancelled
      if (inputReason.trim()) {
        banReason = inputReason.trim();
      }
    } else {
      if (!confirm(`Are you sure you want to UNBAN ${user.name} (${user.phone})? They will immediately regain access to discovery and matches.`)) {
        return;
      }
    }

    setActionLoadingId(user.id);
    try {
      await api.toggleBanUser(user.id, shouldBan, shouldBan ? banReason : undefined);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isBanned: shouldBan, banReason: shouldBan ? banReason : null }
            : u,
        ),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) =>
          prev
            ? { ...prev, isBanned: shouldBan, banReason: shouldBan ? banReason : null }
            : null,
        );
      }
    } catch (e: any) {
      alert(e.message || 'Could not update ban status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete user ${user.name} (${user.phone})? This action cannot be undone.`)) {
      return;
    }
    setActionLoadingId(user.id);
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
    } catch (e: any) {
      alert(e.message || 'Could not delete user');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'VERIFIED' && !u.isVerified) return false;
      if (statusFilter === 'BANNED' && !u.isBanned) return false;
      if (statusFilter === 'ACTIVE' && u.isBanned) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesPhone = u.phone?.toLowerCase().includes(q);
        const matchesBio = u.bio?.toLowerCase().includes(q);
        const matchesReason = u.banReason?.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesBio || matchesReason;
      }
      return true;
    });
  }, [users, statusFilter, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>User Management</span>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300">
              {filteredUsers.length} Users
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Browse all user accounts, check profile details, approve/ban bad actors, and restore or unban users anytime.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors border border-zinc-700/60 shadow-sm cursor-pointer self-start md:self-auto"
        >
          <IconRefresh size={15} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 backdrop-blur-md shrink-0 shadow-lg">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full sm:w-auto flex items-center gap-2">
          <div className="relative flex-1">
            <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, phone (+91...), or bio keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/80 transition-colors shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchUsers();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-95 text-xs font-bold text-white shadow-md transition-all cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 shrink-0 overflow-x-auto max-w-full">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🟢 Active ({users.filter((u) => !u.isBanned).length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('BANNED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'BANNED'
                ? 'bg-red-600 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🚫 Banned ({users.filter((u) => u.isBanned).length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('VERIFIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === 'VERIFIED'
                ? 'bg-sky-500 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span className="text-sky-400">✓</span> Verified ({users.filter((u) => u.isVerified).length})
          </button>
        </div>
      </div>

      {/* Main Scrollable Table Card */}
      <div className="flex-1 rounded-3xl bg-zinc-900/60 border border-zinc-800/90 overflow-hidden shadow-2xl flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-400 font-medium">Loading user directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-2 text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center mb-2">
              <IconUser size={24} />
            </div>
            <h3 className="text-base font-bold text-white">No Users Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              No registered profiles matched your query. Try clearing the search or filters.
            </p>
          </div>
        ) : (
          /* Scrollable Container with Sticky Table Header */
          <div className="flex-1 overflow-y-auto overflow-x-auto relative">
            <table className="w-full text-left text-xs text-zinc-300 border-collapse">
              <thead className="sticky top-0 z-20 bg-zinc-950/95 text-[11px] uppercase font-bold text-zinc-400 border-b border-zinc-800 backdrop-blur-md shadow-sm">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Phone & Location</th>
                  <th className="px-5 py-3.5">Status & Verification</th>
                  <th className="px-5 py-3.5">Activity Stats</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {filteredUsers.map((u) => {
                  const avatar =
                    u.photos?.[0]?.url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600';
                  const isSelected = selectedUser?.id === u.id;

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : u.isBanned
                          ? 'bg-red-950/15 hover:bg-red-950/25'
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* User Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full overflow-hidden border shrink-0 ${
                            u.isBanned ? 'border-red-500/80 grayscale opacity-80' : 'border-zinc-700/80 bg-zinc-800'
                          }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatar} alt={u.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              <span className={u.isBanned ? 'line-through text-zinc-400' : ''}>
                                {u.name || 'Unnamed User'}
                              </span>
                              {u.isVerified && (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 bg-sky-500 text-white rounded-full text-[10px] font-bold"
                                  title="Blue Badge Verified"
                                >
                                  ✓
                                </span>
                              )}
                              {u.isBanned && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/40 uppercase">
                                  Banned
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 capitalize">
                              {u.gender || 'Not Specified'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Location */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-zinc-100 font-mono text-xs">{u.phone}</div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <IconMapPin size={12} className="text-rose-400 shrink-0" />
                          <span>{u.passportCity || 'Local Coordinates'}</span>
                        </div>
                      </td>

                      {/* Status & Verification Badges */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          {u.isBanned ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                <span>🚫</span>
                                <span>Banned</span>
                              </span>
                              {u.banReason && (
                                <span className="block text-[10px] text-zinc-400 truncate max-w-[140px] mt-0.5" title={u.banReason}>
                                  {u.banReason}
                                </span>
                              )}
                            </div>
                          ) : u.isVerified ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              <span>✓</span>
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                              🟢 Active
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Matches & Swipes */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 text-xs">
                          <span className="flex items-center gap-1 text-rose-400 font-bold" title="Matches">
                            <IconHeart size={13} /> {u.matchCount}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="flex items-center gap-1 text-amber-400 font-bold" title="Swipes">
                            <IconFlame size={13} /> {u.swipesCount}
                          </span>
                          {u.reportsCount > 0 && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="flex items-center gap-1 text-red-400 font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30">
                                <IconAlertTriangle size={12} /> {u.reportsCount}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3.5 text-zinc-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVerify(u);
                          }}
                          disabled={actionLoadingId === u.id}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                            u.isVerified
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                              : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40'
                          }`}
                        >
                          {u.isVerified ? 'Revoke ✓' : 'Verify ✓'}
                        </button>

                        {/* Ban / Unban 1-Click Button */}
                        {u.isBanned ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBan(u, false);
                            }}
                            disabled={actionLoadingId === u.id}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition-all cursor-pointer shadow-sm"
                            title="Unban this user"
                          >
                            <span>Unban 🟢</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBan(u, true);
                            }}
                            disabled={actionLoadingId === u.id}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all cursor-pointer shadow-sm"
                            title="Ban user account"
                          >
                            <span>Ban 🚫</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(u);
                          }}
                          disabled={actionLoadingId === u.id}
                          className="p-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all cursor-pointer inline-flex items-center justify-center align-middle"
                          title="Permanently Delete User"
                        >
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Quick Inspector Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full overflow-hidden border-2 shrink-0 ${
                  selectedUser.isBanned ? 'border-red-500 grayscale' : 'border-rose-500/60'
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedUser.photos?.[0]?.url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600'}
                    alt={selectedUser.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span className={selectedUser.isBanned ? 'line-through text-zinc-400' : ''}>
                      {selectedUser.name || 'Unnamed'}
                    </span>
                    {selectedUser.isVerified && <span className="text-sky-400 text-xs font-semibold">✓ Verified</span>}
                    {selectedUser.isBanned && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 uppercase">
                        Banned
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">{selectedUser.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Banned Alert Banner if user is banned */}
            {selectedUser.isBanned && (
              <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5">
                <span className="text-base">🚫</span>
                <div>
                  <h4 className="text-xs font-bold text-red-400">This User is Currently Banned</h4>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Reason: {selectedUser.banReason || 'Violation of Community Guidelines'}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Banned users are hidden from the Discovery deck and unable to match or chat.
                  </p>
                </div>
              </div>
            )}

            {/* Photos */}
            {selectedUser.photos && selectedUser.photos.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Uploaded Photos ({selectedUser.photos.length})
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {selectedUser.photos.map((p) => (
                    <div key={p.id} className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="User photo" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Bio & Details
              </span>
              <p className="text-xs text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 leading-relaxed">
                {selectedUser.bio || 'No bio provided'}
              </p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                <span className="text-rose-400 font-extrabold text-base block">{selectedUser.matchCount}</span>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Matches</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                <span className="text-amber-400 font-extrabold text-base block">{selectedUser.swipesCount}</span>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Swipes</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                <span className="text-red-400 font-extrabold text-base block">{selectedUser.reportsCount}</span>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Reports</span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-zinc-800">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleVerify(selectedUser)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedUser.isVerified
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                  }`}
                >
                  {selectedUser.isVerified ? 'Revoke Checkmark' : 'Grant Blue Badge ✓'}
                </button>

                {selectedUser.isBanned ? (
                  <button
                    type="button"
                    onClick={() => handleToggleBan(selectedUser, false)}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    Unban User 🟢
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleBan(selectedUser, true)}
                    className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                  >
                    Ban User 🚫
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteUser(selectedUser)}
                className="w-full py-2 rounded-xl text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-950 transition-colors"
              >
                Permanently Delete User Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
