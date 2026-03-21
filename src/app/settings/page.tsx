'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { auth } from '@/lib/firebase/client';
import { Mail, Plus, ArrowLeft, Copy, Check, ShieldAlert, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DepartmentsManager from '@/components/settings/DepartmentsManager';
import DepartmentSelector from '@/components/ui/DepartmentSelector';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'superadmin' | 'admin' | 'viewer';
  departmentIds?: string[];
  telegramChatId?: string;
  lastLoginAt?: string;
  creationTime?: string;
}

export default function SettingsPage() {
  const { isSuperAdmin, user: currentUser, loading: authLoading } = useAuth();
  const { t, language } = useTranslation();
  const dir = language === 'he' ? 'rtl' : 'ltr';
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviteDepartmentIds, setInviteDepartmentIds] = useState<string[]>([]);
  const [inviteTelegramId, setInviteTelegramId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [authLoading, isSuperAdmin]);

  const fetchUsers = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = await currentUser?.getIdToken();
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(t('settings.errorFetch'));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult('');
    setInviteLink('');
    setCopied(false);
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole, 
          displayName: inviteEmail.split('@')[0],
          departmentIds: inviteDepartmentIds,
          telegramChatId: inviteTelegramId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite');
      setInviteResult(t('settings.inviteSuccess') || 'משתמש הוזמן בהצלחה! קישור איפוס סיסמה:');
      setInviteLink(data.resetLink);
      setInviteEmail('');
      setInviteDepartmentIds([]);
      setInviteTelegramId('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    // Optimistic Update
    const previousUsers = [...users];
    setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole as any } : u));
    
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Failed to update role');
      fetchUsers(false); // Silent fetch to ensure consistency
    } catch (err: any) {
      setUsers(previousUsers); // Revert
      alert(err.message);
    }
  };

  const handleDepartmentChange = async (uid: string, newDepartmentIds: string[]) => {
    // Optimistic Update
    const previousUsers = [...users];
    setUsers(users.map(u => u.uid === uid ? { ...u, departmentIds: newDepartmentIds } : u));
    
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ departmentIds: newDepartmentIds })
      });
      if (!res.ok) throw new Error('Failed to update departments');
      // No need to fetchUsers() immediately to prevent jitter. Or do silent background fetch.
      fetchUsers(false);
    } catch (err: any) {
      setUsers(previousUsers); // Revert
      alert(err.message);
    }
  };

  const handleTelegramIdChange = async (uid: string, newId: string) => {
    // Optimistic Update
    const previousUsers = [...users];
    setUsers(users.map(u => u.uid === uid ? { ...u, telegramChatId: newId } : u));
    
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ telegramChatId: newId })
      });
      if (!res.ok) throw new Error('Failed to update Telegram ID');
      fetchUsers(false);
    } catch (err: any) {
      setUsers(previousUsers); // Revert
      alert(err.message);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm(t('settings.deleteConfirm'))) return;
    
    // Optimistic Update
    const previousUsers = [...users];
    setUsers(users.filter(u => u.uid !== uid));
    
    try {
      const token = await currentUser?.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchUsers(false);
    } catch (err: any) {
      setUsers(previousUsers); // Revert
      alert(err.message);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950 text-indigo-500">{t('common.loading')}</div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center dark:bg-zinc-950">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-xl font-bold dark:text-zinc-200">{t('settings.noPerms')}</h1>
        <button onClick={() => router.push('/')} className="mt-4 text-indigo-500 hover:underline">
          {t('settings.btnBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-6 sm:p-12 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div>
            <button 
                onClick={() => router.push('/')} 
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors"
                aria-label={t('settings.btnBack')}
            >
              <ArrowLeft className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              {t('settings.btnBack')}
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight">{t('settings.title')}</h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">{t('settings.subtitle')}</p>
          </div>
        </div>

        {/* Invite Form */}
        <section className="bg-white dark:bg-zinc-900 p-6 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-500"/> {t('settings.modalInviteTitle')}</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full relative">
              <label className="block tracking-wide text-xs font-semibold mb-2 text-slate-500">{t('settings.emailLabel')}</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="colleague@company.com"
                />
                <Mail className={`w-5 h-5 text-slate-400 absolute top-2.5 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label className="block tracking-wide text-xs font-semibold mb-2 text-slate-500">{t('settings.roleLabel')}</label>
              <select 
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="viewer">{t('settings.roleViewer')}</option>
                <option value="admin">{t('settings.roleAdmin')}</option>
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="block tracking-wide text-xs font-semibold mb-2 text-slate-500">Telegram ID</label>
              <input 
                type="text"
                value={inviteTelegramId}
                onChange={(e) => setInviteTelegramId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                placeholder="123456789"
              />
            </div>
            <div className="w-full sm:w-64 relative">
               <label className="block tracking-wide text-xs font-semibold mb-2 text-slate-500">{t('settings.departmentAssignLabel')}</label>
               <DepartmentSelector
                 selectedIds={inviteDepartmentIds}
                 onChange={setInviteDepartmentIds}
                 placeholder={t('settings.departmentSelectPlaceholder')}
                 disabled={inviting}
               />
            </div>
            <button 
              type="submit" 
              disabled={inviting}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors h-[42px]"
            >
              {inviting ? t('settings.inviteLoading') : t('settings.inviteBtn')}
            </button>
          </form>
          {inviteResult && (
             <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl space-y-3">
               <div className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                 {inviteResult}
               </div>
               {inviteLink && (
                 <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
                   <input
                     type="text"
                     readOnly
                     value={inviteLink}
                     className="flex-1 bg-transparent text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 outline-none select-all font-mono text-left"
                     dir="ltr"
                   />
                   <button
                     type="button"
                     onClick={() => {
                         navigator.clipboard.writeText(inviteLink);
                         setCopied(true);
                         setTimeout(() => setCopied(false), 2000);
                     }}
                     className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-800/40 dark:hover:bg-emerald-700/50 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-semibold transition-colors outline-none"
                   >
                     {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                     <span className="hidden sm:inline">{copied ? 'הועתק!' : 'העתק קישור'}</span>
                     <span className="sm:hidden">{copied ? 'הועתק' : 'העתק'}</span>
                   </button>
                 </div>
               )}
             </div>
          )}
        </section>

        {/* Departments Manager */}
        <DepartmentsManager />

        {/* Users Table */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-zinc-950/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">{t('settings.tableEmail')}</th>
                    <th className="px-6 py-4 w-40">Telegram ID</th>
                    <th className="px-6 py-4 w-40">{t('settings.tableRole')}</th>
                    <th className="px-6 py-4 w-64 hidden sm:table-cell">{t('settings.tableDepartments')}</th>
                    <th className="px-6 py-4 hidden md:table-cell">{t('settings.tableLastLogin')}</th>
                    <th className="px-6 py-4 w-24 text-center">{t('settings.tableActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {users.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                          {u.email.charAt(0)}
                        </div>
                        <div>
                           <div>{u.email}</div>
                           <div className="text-xs text-slate-400">{u.uid}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={u.telegramChatId || ''}
                          onChange={(e) => handleTelegramIdChange(u.uid, e.target.value)}
                          placeholder="ID..."
                          className="bg-transparent border border-slate-200 dark:border-zinc-700 rounded p-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full font-mono text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                          disabled={u.uid === currentUser?.uid} // can't change own role easily here to prevent lockout
                          className="bg-transparent border border-slate-200 dark:border-zinc-700 rounded p-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        >
                          <option value="superadmin">{t('settings.roleSuperAdmin')}</option>
                          <option value="admin">{t('settings.roleAdmin')}</option>
                          <option value="viewer">{t('settings.roleViewer')}</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                         <div className="w-full relative z-10 w-48 lg:w-full">
                           <DepartmentSelector
                             selectedIds={u.departmentIds || []}
                             onChange={(ids) => handleDepartmentChange(u.uid, ids)}
                             placeholder={t('settings.allDepartmentsPlaceholder')}
                             disabled={u.uid === currentUser?.uid && u.role === 'superadmin'}
                           />
                         </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-slate-500">
                         {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-center">
                         {u.uid !== currentUser?.uid && (
                           <button 
                             onClick={() => handleDelete(u.uid)}
                             className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                             aria-label={t('settings.btnDelete')}
                             title={t('settings.btnDelete')}
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </section>

      </div>
    </div>
  );
}
