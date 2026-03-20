'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, GitMerge } from 'lucide-react';
import { useTranslation } from '@/lib/contexts/LanguageContext';

interface BulkActionBarProps {
    selectedCount: number;
    baseClientName?: string;
    onClearSelection: () => void;
    onDeleteSelected: () => void;
    onMergeSelected: () => void;
}

export default function BulkActionBar({
    selectedCount,
    baseClientName,
    onClearSelection,
    onDeleteSelected,
    onMergeSelected
}: BulkActionBarProps) {
    const { t } = useTranslation();

    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
                >
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-2xl shadow-indigo-500/10 rounded-2xl px-4 py-3 flex items-center gap-4 sm:gap-6 backdrop-blur-xl">
                        {/* Status */}
                        <div className="flex flex-col rtl:ml-2 ltr:mr-2 pointer-events-none select-none">
                            <span className="text-slate-900 dark:text-white text-[14px] font-bold">
                                {selectedCount} {t('bulk.itemsSelected') ? t('bulk.itemsSelected').split(' ')[0] : 'Items'} {t('dashboard.actionMergeSelected') ? t('dashboard.actionMergeSelected').split(' ')[1] : 'Selected'}
                            </span>
                            {baseClientName && (
                                <span className="text-slate-400 text-[11px] font-medium max-w-[150px] truncate">
                                    {baseClientName}
                                </span>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onMergeSelected}
                                className="inline-flex items-center justify-center px-4 h-9 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={selectedCount < 2}
                                title={t('dashboard.actionMergeSelected') || 'Merge'}
                            >
                                <GitMerge className="h-4 w-4 rtl:ml-2 ltr:mr-2" />
                                <span className="hidden sm:inline">{t('dashboard.actionMergeSelected') || 'Merge'}</span>
                            </button>

                            <button
                                onClick={onDeleteSelected}
                                className="inline-flex items-center justify-center px-4 h-9 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                                title={t('dashboard.actionDeleteSelected') || 'Delete'}
                            >
                                <Trash2 className="h-4 w-4 rtl:ml-2 ltr:mr-2" />
                                <span className="hidden sm:inline">{t('dashboard.actionDeleteSelected') || 'Delete'}</span>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-slate-200 dark:bg-zinc-700" />

                        {/* Close */}
                        <button
                            onClick={onClearSelection}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none"
                            aria-label={t('common.clear') || 'Clear'}
                            title={t('common.clear') || 'Clear'}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
