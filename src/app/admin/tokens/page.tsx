'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Activity, Edit3, Save, X } from 'lucide-react';

type UserTokenData = {
    uid: string;
    email: string;
    displayName: string;
    tokensUsedThisMonth: number;
    monthlyTokenLimit: number;
    lifetimeTokensUsed: number;
    costUSD?: number;
    modelsUsed?: string[];
    departmentIds?: string[];
};

type Department = {
    id: string;
    name: string;
};

export default function AdminTokensPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [users, setUsers] = useState<UserTokenData[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingUid, setEditingUid] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, [user]);

    const fetchUsers = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/tokens', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(t('tokens.fetchError'));
            const data = await res.json();
            setUsers(data.users || []);
            setDepartments(data.departments || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLimit = async (uid: string) => {
        try {
            const token = await user?.getIdToken();
            const numericLimit = parseInt(editValue, 10);
            if (isNaN(numericLimit)) throw new Error(t('tokens.invalidLimit'));

            const res = await fetch('/api/admin/tokens', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ uid, newLimit: numericLimit })
            });
            if (!res.ok) throw new Error(t('tokens.updateLimitError'));
            
            setUsers(users.map(u => u.uid === uid ? { ...u, monthlyTokenLimit: numericLimit } : u));
            setEditingUid(null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const renderTable = (usersToRender: UserTokenData[]) => (
        <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-slate-600 dark:text-zinc-400">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-zinc-800/50 dark:text-zinc-400 uppercase border-b border-slate-200 dark:border-zinc-800">
                    <tr>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderName')}</th>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderEmail')}</th>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderUsage')}</th>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderHistory')}</th>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderCost')}</th>
                        <th className="px-6 py-4 font-medium">{t('tokens.tableHeaderModels')}</th>
                        <th className="px-6 py-4 font-medium text-left">{t('tokens.tableHeaderActions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {isLoading ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            </td>
                        </tr>
                    ) : usersToRender.map((u) => {
                        const usagePercent = u.monthlyTokenLimit > 0 ? Math.min(100, Math.round((u.tokensUsedThisMonth / u.monthlyTokenLimit) * 100)) : 0;
                        const isCloseToLimit = usagePercent > 85;

                        const fmtMonth = new Intl.NumberFormat().format(u.tokensUsedThisMonth);
                        const fmtLimit = new Intl.NumberFormat().format(u.monthlyTokenLimit);
                        const fmtLife = new Intl.NumberFormat().format(u.lifetimeTokensUsed);

                        return (
                            <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-zinc-100">{u.displayName}</td>
                                <td className="px-6 py-4">{u.email}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span dir="ltr">{fmtMonth} / {fmtLimit}</span>
                                            <span className={isCloseToLimit ? 'text-rose-500 font-bold' : ''}>{usagePercent}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                                            <div className={`h-2 rounded-full ${isCloseToLimit ? 'bg-rose-500' : 'bg-emerald-500'} transition-all duration-500`} style={{ width: `${usagePercent}%` }}></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{fmtLife}</td>
                                <td className="px-6 py-4 font-medium text-emerald-600 dark:text-emerald-400">${(u.costUSD || 0).toFixed(5)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {(u.modelsUsed || []).map((m) => (
                                            <span key={m} className="px-2 py-1 text-[10px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 rounded-md">{m}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-left">
                                    {editingUid === u.uid ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-24 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg" />
                                            <button onClick={() => handleSaveLimit(u.uid)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingUid(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setEditingUid(u.uid); setEditValue(u.monthlyTokenLimit.toString()); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors">
                                            <Edit3 className="w-3 h-3" /> {t('tokens.btnEditLimit')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <AuthGuard requireSuperAdmin>
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                                {t('tokens.title')}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                                {t('tokens.subtitle')}
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800/30">
                        {error}
                    </div>
                )}

                {/* Org Totals */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">{t('tokens.orgTotalCost')}</h3>
                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            ${users.reduce((acc, u) => acc + (u.costUSD || 0), 0).toFixed(4)}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">{t('tokens.orgTotalTokens')}</h3>
                        <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                            {new Intl.NumberFormat().format(users.reduce((acc, u) => acc + (u.tokensUsedThisMonth || 0), 0))}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800">
                         <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">{t('tokens.activeUsers')}</h3>
                         <div className="text-3xl font-black text-slate-900 dark:text-zinc-100">
                            {users.filter(u => u.tokensUsedThisMonth > 0).length} / {users.length}
                         </div>
                    </div>
                </div>

                <div className="space-y-12">
                    {departments.length > 0 ? departments.map(dept => {
                        const deptUsers = users.filter(u => u.departmentIds?.includes(dept.id));
                        if (deptUsers.length === 0) return null;
                        const deptCost = deptUsers.reduce((acc, u) => acc + (u.costUSD || 0), 0);

                        return (
                            <div key={dept.id} className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                                        {dept.name}
                                        <span className="text-xs font-normal text-slate-500 dark:text-zinc-500 mr-2">
                                            {t('tokens.usersCount', { count: deptUsers.length })}
                                        </span>
                                    </h2>
                                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">
                                        {t('tokens.deptCost', { cost: deptCost.toFixed(5) })}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                     {renderTable(deptUsers)}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                            {renderTable(users)}
                        </div>
                    )}

                    {/* Users without departments */}
                    {departments.length > 0 && users.filter(u => !u.departmentIds || u.departmentIds.length === 0).length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200 px-2">{t('tokens.noDept')}</h2>
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                                {renderTable(users.filter(u => !u.departmentIds || u.departmentIds.length === 0))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
