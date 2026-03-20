import React from 'react';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import TagSelector from '@/components/ui/TagSelector';
import { Filter, XCircle } from 'lucide-react';

interface DashboardFiltersProps {
    status: string;
    onStatusChange: (status: string) => void;
    tagId: string;
    onTagChange: (tagId: string) => void;
}

export default function DashboardFilters({ status, onStatusChange, tagId, onTagChange }: DashboardFiltersProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/60 shadow-sm mb-8">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <Filter className="w-4 h-4" />
                <span className="text-[13px] font-bold uppercase tracking-wider">{t('common.filter') || 'Filter By'}</span>
            </div>

            <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-[200px]">
                    <select
                        value={status}
                        onChange={(e) => onStatusChange(e.target.value)}
                        className="w-full h-[42px] px-4 text-[13px] font-medium bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                    >
                        <option value="all">{t('filters.statusAll') || 'All Statuses'}</option>
                        <option value="pending">{t('dashboard.statusPending') || 'Pending'}</option>
                        <option value="in_progress">{t('dashboard.statusInProgress') || 'In Progress'}</option>
                        <option value="approved">{t('editor.statusApproved') || 'Approved'}</option>
                    </select>
                </div>

                <div className="w-full sm:w-[300px] z-20">
                    <TagSelector
                        selectedIds={tagId ? [tagId] : []}
                        onChange={(tags) => onTagChange(tags.length > 0 ? tags[0] : '')}
                        maxTags={1}
                        placeholder={t('filters.filterByTag') || 'Filter by tag...'}
                    />
                </div>
            </div>

            {(status !== 'all' || tagId !== '') && (
                <button
                    onClick={() => {
                        onStatusChange('all');
                        onTagChange('');
                    }}
                    className="flex shrink-0 items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                    title={t('common.clearFilters') || 'Clear Filters'}
                >
                    <XCircle className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}
