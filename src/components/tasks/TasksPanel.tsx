'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, CheckCircle2, Clock, User, Sparkles, Loader2, AlertCircle, Circle, Trash2 } from 'lucide-react';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Task } from '@/lib/types/task';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import AssigneeSelector from '@/components/ui/AssigneeSelector';

interface TasksPanelProps {
    isOpen: boolean;
    onClose: () => void;
    draftId: string;
    content: string;
    metadata: {
        title: string;
        clientName: string;
        tags: string[];
    };
}

export default function TasksPanel({ isOpen, onClose, draftId, content, metadata }: TasksPanelProps) {
    const { t, language } = useTranslation();
    
    const [savedTasks, setSavedTasks] = useState<Task[]>([]);
    const [extractedTasks, setExtractedTasks] = useState<Partial<Task>[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !draftId) return;

        const q = query(
            collection(db, 'tasks'),
            where('sourceId', '==', draftId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Task[] = [];
            snapshot.forEach((d) => {
                results.push({ id: d.id, ...d.data() } as Task);
            });
            // Sort client-side by createdAt descending
            results.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            setSavedTasks(results);
        });

        return () => unsubscribe();
    }, [isOpen, draftId]);

    // Handle initial cleanup when panel is closed
    useEffect(() => {
        if (!isOpen) {
            setExtractedTasks([]);
            setError('');
        }
    }, [isOpen]);

    const handleExtract = async () => {
        if (!content.trim()) {
            setError(t('editor.alertEmpty') || 'Content is empty.');
            return;
        }

        setIsExtracting(true);
        setError('');
        setExtractedTasks([]); // Clear past extractions

        try {
            const token = await auth.currentUser?.getIdToken();
            
            const response = await fetch('/api/tasks/extract', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    content,
                    metadata: {
                        title: metadata.title,
                        clientName: metadata.clientName,
                        tags: metadata.tags,
                        currentDate: new Date().toISOString(),
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to extract tasks');
            }

            const data = await response.json();
            if (data.tasks && Array.isArray(data.tasks)) {
                setExtractedTasks(data.tasks);
            } else {
                setExtractedTasks([]);
            }
        } catch (err: any) {
            console.error('Task extraction error:', err);
            setError(err.message || 'Unknown error occurred during extraction.');
        } finally {
            setIsExtracting(false);
        }
    };

    const handleSaveExtracted = async () => {
        if (extractedTasks.length === 0) return;
        setIsSaving(true);
        setError('');

        try {
            const snapshot = await getCountFromServer(collection(db, 'tasks'));
            const currentCount = snapshot.data().count;
            if (currentCount + extractedTasks.length > 5000) { // Using 5000 as a reasonable limit for tasks
                throw new Error(`שמירת המשימות תחרוג ממכסת המשימות המרבית במערכת. כרגע יש ${currentCount} משימות.`);
            }

            const batchPromises = extractedTasks.map(async (taskObj) => {
                const newTask: Omit<Task, 'id'> = {
                    sourceId: draftId,
                    sourceType: 'draft',
                    title: metadata.title,
                    clientName: metadata.clientName || '',
                    description: taskObj.description || '',
                    assignee: taskObj.assignee || null,
                    deadline: taskObj.deadline || null,
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                return addDoc(collection(db, 'tasks'), newTask);
            });

            await Promise.all(batchPromises);
            setExtractedTasks([]); // clear after save
        } catch (err: any) {
            console.error('Failed to save tasks:', err);
            setError('Failed to save tasks to database.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleTaskStatus = async (task: Task) => {
        if (!task.id) return;
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (err) {
            console.error('Failed to toggle status:', err);
        }
    };

    const handleDeleteSavedTask = async (id: string | undefined) => {
        if (!id) return;
        let confirmMsg = 'Are you sure you want to delete this task?';
        if (typeof window !== 'undefined') {
            confirmMsg = t('common.delete') || confirmMsg;
        }
        if (confirm(confirmMsg)) {
            try {
                await deleteDoc(doc(db, 'tasks', id));
            } catch (err) {
                console.error('Failed to delete task:', err);
            }
        }
    };

    const removeExtractedTask = (index: number) => {
        const newArr = [...extractedTasks];
        newArr.splice(index, 1);
        setExtractedTasks(newArr);
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
                day: '2-digit', month: 'short', year: 'numeric'
            }).format(date);
        } catch (e) {
            return dateString;
        }
    };

    // Render helper for single task card
    const renderTaskCard = (task: any, isPreview: boolean, idx?: number) => {
        const isCompleted = task.status === 'completed';
        const containerClasses = `p-4 rounded-xl border mb-3 ${isPreview ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800'}`;
        const textClasses = `text-sm leading-relaxed ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-zinc-200'}`;
        
        let deadlineClasses = 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400';
        if (task.deadline && new Date(task.deadline) < new Date() && !isCompleted) {
            deadlineClasses = 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400';
        }

        return (
            <div key={task.id || idx} className={containerClasses}>
                <div className="flex gap-3 items-start">
                    {!isPreview && (
                        <button 
                            onClick={() => handleToggleTaskStatus(task)}
                            className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-emerald-500 transition-colors"
                        >
                            {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className={textClasses}>
                            {task.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <div className="w-[160px]">
                                <AssigneeSelector
                                    value={task.assignee || ''}
                                    onChange={(newAssignee) => {
                                        if (isPreview && idx !== undefined) {
                                            const newArr = [...extractedTasks];
                                            newArr[idx].assignee = newAssignee;
                                            setExtractedTasks(newArr);
                                        } else if (!isPreview && task.id) {
                                            updateDoc(doc(db, 'tasks', task.id), { assignee: newAssignee, updatedAt: new Date() }).catch(console.error);
                                        }
                                    }}
                                    placeholder={t('tasks.filterAssignee') || 'אחראי...'}
                                />
                            </div>
                            {task.deadline && (
                                <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${deadlineClasses}`}>
                                    <Clock className="w-3 h-3" />
                                    {formatDate(task.deadline)}
                                </span>
                            )}
                        </div>
                    </div>
                    {isPreview ? (
                        <button onClick={() => removeExtractedTask(idx!)} className="text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 translate-y-[-4px] translate-x-[4px]">
                            <X className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={() => handleDeleteSavedTask(task.id)} className="text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 translate-y-[-4px] translate-x-[4px]">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const side = language === 'he' ? 'left-0' : 'right-0';
    const borderClass = language === 'he' ? 'border-r' : 'border-l';
    const initialPos = language === 'he' ? '-100%' : '100%';
    const panelClasses = `fixed top-0 bottom-0 ${side} w-full sm:w-[450px] bg-white dark:bg-zinc-950 ${borderClass} border-slate-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl transition-colors`;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm z-40 transition-colors"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: initialPos }}
                        animate={{ x: 0 }}
                        exit={{ x: initialPos }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={panelClasses}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800/80">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">
                                    {t('tasks.panelTitle') || 'משימות ופעולות לביצוע'}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                    {t('tasks.panelDesc') || 'השתמש בבינה מלאכותית לחילוץ משימות מהטקסט הנוכחי.'}
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 -mx-2 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-zinc-900/20">
                            
                            {/* Action Area */}
                            <div className="mb-8">
                                <button
                                    onClick={handleExtract}
                                    disabled={isExtracting || !content.trim()}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    {isExtracting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    )}
                                    {isExtracting ? (t('tasks.extracting') || 'מחלץ משימות...') : (t('tasks.btnExtract') || 'חילוץ משימות (AI)')}
                                </button>
                                
                                {error && (
                                    <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-900/30">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>

                            {/* Extracted Tasks Preview */}
                            {extractedTasks.length > 0 && (
                                <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <span>{t('tasks.previewTitle') || 'תוצאות חילוץ'} ({extractedTasks.length})</span>
                                        <button 
                                            onClick={() => setExtractedTasks([])}
                                            className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                                        >
                                            {t('common.cancel') || 'ביטול'}
                                        </button>
                                    </div>
                                    <div className="space-y-0">
                                        {extractedTasks.map((t, i) => renderTaskCard(t, true, i))}
                                    </div>
                                    <button
                                        onClick={handleSaveExtracted}
                                        disabled={isSaving}
                                        className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-all shadow-emerald-600/20 hover:shadow-emerald-600/30 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {t('tasks.btnSaveTasks') || 'שמור משימות בארכיון'}
                                    </button>
                                </div>
                            )}

                            {/* Saved Tasks */}
                            {savedTasks.length > 0 ? (
                                <div>
                                    <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <span>{t('tasks.savedTasksTitle') || 'משימות שמורות למסמך זה'}</span>
                                        <span className="bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 py-0.5 px-1.5 rounded-full text-[10px] flex justify-center items-center">
                                            {savedTasks.length}
                                        </span>
                                    </div>
                                    <div className="space-y-0">
                                        <AnimatePresence>
                                            {savedTasks.map(t => (
                                                <motion.div
                                                    key={t.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                >
                                                    {renderTaskCard(t, false)}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 opacity-60">
                                    <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500 dark:text-zinc-500">
                                        {t('tasks.emptyDesc') || 'לא נמצאו משימות שמורות בטיוטה זו.'}
                                    </p>
                                </div>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
