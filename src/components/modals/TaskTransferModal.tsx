'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import ClientSelector from '@/components/ui/ClientSelector';

interface TaskTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmTransfer: (newClientName: string) => Promise<void>;
    onConfirmDeleteAll?: () => Promise<void>;
    taskCount: number;
    entityType: 'draft' | 'knowledge';
}

export default function TaskTransferModal({
    isOpen,
    onClose,
    onConfirmTransfer,
    onConfirmDeleteAll,
    taskCount,
    entityType
}: TaskTransferModalProps) {
    const { t } = useTranslation();
    const [selectedClient, setSelectedClient] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleTransfer = async () => {
        if (!selectedClient) {
            alert(t('common.requiredField') || 'אנא בחר לקוח');
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirmTransfer(selectedClient);
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    const handleDeleteAll = async () => {
        if (!onConfirmDeleteAll) return;
        const confirmMsg = t('drafts.confirmDeleteAll') || 'האם אתה בטוח שברצונך למחוק את המסמך ואת כל המשימות המקושרות אליו? לא ניתן לבטל פעולה זו.';
        if (!confirm(confirmMsg)) return;

        setIsSubmitting(true);
        try {
            await onConfirmDeleteAll();
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={(e) => {
                    if (e.target === e.currentTarget && !isSubmitting) onClose();
                }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
                >
                    <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
                            <AlertTriangle className="w-6 h-6" />
                            <h2 className="text-xl font-bold">
                                {t('drafts.tasksLinkedTitle') || 'משימות מקושרות נמצאו'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                            {entityType === 'knowledge' 
                                ? (t('knowledge.warnTasksDelete') || `למסמך זה מקושרות ${taskCount} משימות פעילות. עליך להעביר משימות אלו ללקוח אחר לפני שתוכל למחוק את המסמך.`)
                                : (t('drafts.warnTasksDelete') || `לטיוטה זו מקושרות ${taskCount} משימות פעילות. מחיקת הטיוטה תמחק גם את המשימות הללו, אלא אם תעביר אותן ללקוח אחר כמפורט מטה.`)}
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                            <h3 className="font-semibold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                                <ArrowRight className="w-4 h-4" />
                                {t('drafts.transferTasksLabel') || 'העברת משימות ללקוח אחר'}
                            </h3>
                            <ClientSelector 
                                value={selectedClient} 
                                onChange={setSelectedClient} 
                            />
                            <button
                                onClick={handleTransfer}
                                disabled={!selectedClient || isSubmitting}
                                className="mt-4 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    t('drafts.confirmTransfer') || 'העבר משימות ומחק מסמך'
                                )}
                            </button>
                        </div>
                    </div>

                    {entityType === 'draft' && onConfirmDeleteAll && (
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center">
                            <p className="text-sm text-gray-500 mb-4 text-center">
                                {t('drafts.orDeleteAllLabel') || 'או מחיקה מלאה של הטיוטה והמשימות'}
                            </p>
                            <button
                                onClick={handleDeleteAll}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-xl font-medium transition-colors w-full"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                                ) : (
                                    t('drafts.deleteAllBtn') || 'מחק הכל (טיוטה + משימות)'
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
