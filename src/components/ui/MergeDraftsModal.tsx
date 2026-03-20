'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitMerge, FileText, CheckCircle2 } from 'lucide-react';
import { Draft } from '@/lib/hooks/usePendingDrafts';
import { useTranslation } from '@/lib/contexts/LanguageContext';

interface MergeDraftsModalProps {
    isOpen: boolean;
    onClose: () => void;
    drafts: Draft[];
    onConfirm: (mergedData: Partial<Draft>) => Promise<void>;
}

export default function MergeDraftsModal({ isOpen, onClose, drafts, onConfirm }: MergeDraftsModalProps) {
    const { t } = useTranslation();
    const [isMerging, setIsMerging] = useState(false);
    const [previewText, setPreviewText] = useState('');
    const [previewTags, setPreviewTags] = useState<string[]>([]);
    const [mergedTitle, setMergedTitle] = useState('');

    useEffect(() => {
        if (isOpen && drafts.length > 0) {
            // Auto-merge strategy
            const sortedDrafts = [...drafts].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
            const primary = sortedDrafts[0];
            
            setMergedTitle(primary.title || primary.clientName || 'Merged Draft');
            
            // Concatenate text
            const combinedText = sortedDrafts
                .map(d => `--- From: ${d.title || d.clientName || 'Untitled'} ---\n${d.text || ''}`)
                .join('\n\n');
            setPreviewText(combinedText);

            // Union tags
            const allTags = sortedDrafts.flatMap(d => d.tags || []);
            setPreviewTags(Array.from(new Set(allTags)));
        }
    }, [isOpen, drafts]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsMerging(true);
        try {
            const primary = drafts[0];
            const audioFileId = drafts.find(d => !!d.audioFileId)?.audioFileId;

            await onConfirm({
                title: mergedTitle,
                clientName: primary.clientName,
                text: previewText,
                tags: previewTags,
                status: primary.status, // Keep base status
                audioFileId: audioFileId || null,
            });
            onClose();
        } catch (error) {
            console.error('Merge failed', error);
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="auto">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-400/30 dark:bg-black/80 backdrop-blur-sm"
                />
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-zinc-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <GitMerge className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                                    {t('dashboard.actionMergeSelected') || 'Merge Drafts'}
                                </h2>
                                <p className="text-[13px] text-slate-500 dark:text-zinc-400 font-medium">
                                    {drafts.length} {t('bulk.itemsSelected') || 'items selected'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30 dark:bg-zinc-950/20">
                        <div className="space-y-6">
                            
                            {/* Merge Logic Explanation */}
                            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 flex gap-3 text-indigo-800 dark:text-indigo-300">
                                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                                <div className="text-sm space-y-1">
                                    <p><strong>{t('dashboard.smartMergeApplied') || 'Smart Merge applied:'}</strong></p>
                                    <ul className="list-disc leading-relaxed rtl:mr-5 ltr:ml-5">
                                        <li>{t('bulk.mergeDetails1') || 'Text contents have been concatenated.'}</li>
                                        <li>{t('bulk.mergeDetails2') || 'Tags have been uniquely combined.'}</li>
                                        <li>{t('bulk.mergeDetails3') || 'Original audio files are preserved where available.'}</li>
                                        <li>{t('bulk.mergeDetails4') || 'The original copies will be securely deleted after this merge.'}</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[13px] font-bold text-slate-700 dark:text-zinc-300 mb-1.5 ml-1">
                                    {t('dashboard.mergedTitleLabel') || 'Merged Title'}
                                </label>
                                <input 
                                    type="text"
                                    value={mergedTitle}
                                    onChange={e => setMergedTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-[13px] font-bold text-slate-700 dark:text-zinc-300 mb-1.5 ml-1 flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> {t('dashboard.mergedContentPreview') || 'Merged Content Preview'}
                                </label>
                                <textarea 
                                    value={previewText}
                                    onChange={e => setPreviewText(e.target.value)}
                                    rows={10}
                                    className="w-full p-4 bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl text-[13px] text-slate-700 dark:text-zinc-300 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner resize-y custom-scrollbar leading-relaxed block"
                                />
                            </div>

                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 flex flex-col-reverse sm:flex-row justify-end gap-3 z-10">
                        <button
                            onClick={onClose}
                            disabled={isMerging}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors w-full sm:w-auto text-center disabled:opacity-50"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isMerging}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 w-full sm:w-auto text-center flex justify-center items-center gap-2 disabled:opacity-70"
                        >
                            {isMerging ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('dashboard.actionMergeSelected') || 'Merging...'}
                                </>
                            ) : (
                                <>
                                    <GitMerge className="h-4 w-4" />
                                    {t('dashboard.actionMergeSelected') || 'Confirm Merge'}
                                </>
                            )}
                        </button>
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    );
}
