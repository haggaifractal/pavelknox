'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Shield, RefreshCw, Search, Calendar, Info, Clock, ExternalLink } from 'lucide-react';

type AuditLog = {
    id: string;
    actionType: string;
    userId: string;
    userEmail: string;
    userName?: string;
    targetId?: string;
    details?: any;
    timestamp: string;
};

export default function AdminAuditPage() {
    const { t, language } = useTranslation();
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');

    useEffect(() => {
        fetchLogs();
    }, [user]);

    useEffect(() => {
        filterLogs();
    }, [searchTerm, actionFilter, logs]);

    const fetchLogs = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/audit', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch audit logs');
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filterLogs = () => {
        let filtered = [...logs];

        if (actionFilter !== 'ALL') {
            filtered = filtered.filter(log => log.actionType === actionFilter);
        }

        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(log => 
                log.userName?.toLowerCase().includes(lowSearch) ||
                log.userEmail?.toLowerCase().includes(lowSearch) ||
                log.actionType?.toLowerCase().includes(lowSearch) ||
                JSON.stringify(log.details || '').toLowerCase().includes(lowSearch)
            );
        }

        setFilteredLogs(filtered);
    };

    const getActionBadge = (action: string) => {
        const styles: Record<string, string> = {
            'BOT_DRAFT_CREATED': 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
            'APPROVED_DRAFT': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
            'DELETED_DRAFT': 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
            'MERGED_DRAFTS': 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
            'UPDATE_TOKEN_LIMIT': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
            'DELETE_KNOWLEDGE': 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
            'DELETE_TASK': 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
        };

        const labels: Record<string, string> = {
            'BOT_DRAFT_CREATED': t('audit.actionTypes.BOT_DRAFT_CREATED'),
            'APPROVED_DRAFT': t('audit.actionTypes.APPROVED_DRAFT'),
            'DELETED_DRAFT': t('audit.actionTypes.DELETED_DRAFT'),
            'MERGED_DRAFTS': t('audit.actionTypes.MERGED_DRAFTS'),
            'UPDATE_TOKEN_LIMIT': t('audit.actionTypes.UPDATE_TOKEN_LIMIT'),
            'DELETE_KNOWLEDGE': t('audit.actionTypes.DELETE_KNOWLEDGE'),
            'DELETE_TASK': t('audit.actionTypes.DELETE_TASK'),
            'DELETE_CLIENT': t('audit.actionTypes.DELETE_CLIENT'),
        };

        return (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight uppercase ${styles[action] || 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                {labels[action] || action}
            </span>
        );
    };

    const renderDetails = (log: AuditLog) => {
        if (!log.details) return t('audit.detailsNoDetails');
        
        // If it's a string, just show it
        if (typeof log.details === 'string') return log.details;

        // Special handling for common detail structures
        if (log.details.message) return log.details.message;
        if (log.details.title) return t('audit.detailsTitle', { title: log.details.title });
        if (log.details.deletedTasksCount !== undefined) return t('audit.detailsTasksDeleted', { count: log.details.deletedTasksCount });
        
        // Fallback: key-value pairs
        return Object.entries(log.details)
            .filter(([key]) => key !== 'message')
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ');
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <AuthGuard requireSuperAdmin>
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-[0.2em]">
                            <Shield className="w-4 h-4" />
                            {t('audit.securityPanel')}
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {t('audit.title')}
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-400 text-base max-w-xl leading-relaxed">
                            {t('audit.subtitle')}
                        </p>
                    </div>
                    
                    <button 
                        onClick={fetchLogs}
                        disabled={isLoading}
                        className="flex items-center gap-2.5 px-6 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-0.5"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {t('audit.refresh')}
                    </button>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-rose-50 text-rose-800 dark:bg-rose-900/10 dark:text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-900/20 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                        {error}
                    </div>
                )}

                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="relative group lg:col-span-2">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder={t('audit.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-12 pl-4 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-zinc-100 placeholder:text-slate-400"
                        />
                    </div>
                    
                    <div className="relative">
                        <select 
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-full h-full px-4 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none dark:text-zinc-100 cursor-pointer"
                        >
                            <option value="ALL">{t('audit.filterAll')}</option>
                            <option value="BOT_DRAFT_CREATED">{t('audit.filterBotDraft')}</option>
                            <option value="APPROVED_DRAFT">{t('audit.filterApprove')}</option>
                            <option value="DELETED_DRAFT">{t('audit.filterDelete')}</option>
                            <option value="UPDATE_TOKEN_LIMIT">{t('audit.filterTokens')}</option>
                            <option value="DELETE_KNOWLEDGE">{t('audit.filterKnowledge')}</option>
                        </select>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xs font-black uppercase px-4 py-3.5 shadow-lg shadow-indigo-500/30">
                        {t('audit.eventsFound', { count: filteredLogs.length })}
                    </div>
                </div>

                {/* Main Content Table */}
                <div className="bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl shadow-slate-200/60 dark:shadow-none border border-slate-100 dark:border-zinc-900 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50/50 dark:bg-zinc-900/50 text-slate-400 dark:text-zinc-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100 dark:border-zinc-900">
                                <tr>
                                    <th className="px-8 py-5">{t('audit.tableHeaderTimeUser')}</th>
                                    <th className="px-6 py-5">{t('audit.tableHeaderAction')}</th>
                                    <th className="px-6 py-5">{t('audit.tableHeaderDetails')}</th>
                                    <th className="px-8 py-5 text-left">{t('audit.tableHeaderTarget')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-zinc-900">
                                {isLoading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-8 py-8"><div className="h-4 bg-slate-100 dark:bg-zinc-900 rounded w-40"></div></td>
                                            <td className="px-6 py-8"><div className="h-6 bg-slate-100 dark:bg-zinc-900 rounded-full w-24"></div></td>
                                            <td className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-zinc-900 rounded w-64"></div></td>
                                            <td className="px-8 py-8"><div className="h-4 bg-slate-100 dark:bg-zinc-900 rounded w-20"></div></td>
                                        </tr>
                                    ))
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-all duration-300">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-600 text-[11px] font-bold">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDate(log.timestamp)}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs border border-indigo-100/50 dark:border-zinc-800">
                                                            {log.userName?.substring(0, 1) || log.userEmail?.substring(0, 1).toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800 dark:text-zinc-200 text-[14px] leading-tight group-hover:text-indigo-600 transition-colors">
                                                                {log.userName || t('audit.unknownUser')}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                                                                {log.userEmail}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                {getActionBadge(log.actionType)}
                                            </td>
                                            <td className="px-6 py-6 border-r border-transparent group-hover:border-slate-100 dark:group-hover:border-zinc-900 transition-colors">
                                                <div className="flex items-start gap-2.5 max-w-sm">
                                                    <div className="p-1 px-1.5 bg-slate-100 dark:bg-zinc-900 rounded-md mt-0.5">
                                                        <Info className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                    <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed font-medium">
                                                        {renderDetails(log)}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-left">
                                                {log.targetId ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 text-[11px] font-mono rounded-xl border border-slate-100 dark:border-zinc-800">
                                                        {log.targetId.substring(0, 8)}...
                                                        <ExternalLink className="w-3 h-3 opacity-30" />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-zinc-700 italic text-xs">{t('audit.globalTarget')}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center grayscale opacity-30">
                                                    <Search className="w-10 h-10" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-lg font-black text-slate-800 dark:text-white">{t('audit.noLogsTitle')}</p>
                                                    <p className="text-slate-500 dark:text-zinc-500">{t('audit.noLogsDesc')}</p>
                                                </div>
                                                <button 
                                                    onClick={() => { setSearchTerm(''); setActionFilter('ALL'); }}
                                                    className="px-6 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-black rounded-xl hover:bg-indigo-100 transition-all mt-2"
                                                >
                                                    {t('audit.clearFilters')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer / Pagination Placeholder */}
                    <div className="px-8 py-6 bg-slate-50/30 dark:bg-zinc-900/20 border-t border-slate-100 dark:border-zinc-900 flex justify-between items-center">
                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                            {t('audit.showingLast')}
                        </div>
                        <div className="flex gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 flex"></div>
                             <span className="text-[11px] text-slate-500 font-bold uppercase">{t('audit.systemHealthy')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}

function ChevronDown(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
