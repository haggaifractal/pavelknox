'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Task } from '@/lib/types/task';
import { CheckCircle2, Circle, Clock, User, Briefcase, Trash2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AssigneeSelector from '@/components/ui/AssigneeSelector';
import ClientSelector from '@/components/ui/ClientSelector';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function TasksPage() {
    const { t, language } = useTranslation();
    const { user } = useAuth();
    
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }).format(date);
        } catch (e) {
            return dateString;
        }
    };
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [clientFilter, setClientFilter] = useState<string>('');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('');

    useEffect(() => {
        const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
        
        if (statusFilter !== 'all') {
            constraints.push(where('status', '==', statusFilter));
        }
        if (clientFilter) {
            constraints.push(where('clientName', '==', clientFilter));
        }
        if (assigneeFilter) {
            constraints.push(where('assignee', '==', assigneeFilter));
        }

        const q = query(collection(db, 'tasks'), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Task[] = [];
            snapshot.forEach((d) => {
                results.push({ id: d.id, ...d.data() } as Task);
            });
            setTasks(results);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [statusFilter, clientFilter, assigneeFilter]);

    const handleToggleStatus = async (currentTask: Task) => {
        if (!currentTask.id) return;
        const newStatus = currentTask.status === 'completed' ? 'pending' : 'completed';
        try {
            await updateDoc(doc(db, 'tasks', currentTask.id), {
                status: newStatus,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error('Failed to update task status:', error);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) return;
        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/tasks/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: taskId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete task');
            }
        } catch (error) {
            console.error("Failed to delete task", error);
            alert("שגיאה במחיקת המשימה");
        }
    };

    const getSourceLink = (taskSource: Task) => {
        if (taskSource.sourceType === 'draft') return `/drafts/${taskSource.sourceId}`;
        return `/knowledge/${taskSource.sourceId}`;
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-zinc-300 transition-colors duration-300">
                <main className="max-w-[1400px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                            {t('tasks.title') || 'מרכז משימות'}
                        </h1>
                        <p className="text-slate-500 dark:text-zinc-400 mt-2">
                            {t('tasks.subtitle') || 'ניהול ובקרה על פריטי פעולה מכלל המסמכים.'}
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {t('tasks.filterStatus') || 'סטטוס'}
                            </label>
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-zinc-200"
                            >
                                <option value="all">הכל</option>
                                <option value="pending">ממתין</option>
                                <option value="in_progress">בטיפול</option>
                                <option value="completed">הושלם</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {t('tasks.filterAssignee') || 'אחראי'}
                            </label>
                            <AssigneeSelector 
                                value={assigneeFilter}
                                onChange={(val) => setAssigneeFilter(val === assigneeFilter ? '' : val)}
                                placeholder={t('tasks.filterAssignee') || 'הקלד שם...'}
                                className="bg-slate-50 dark:bg-zinc-950"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {t('tasks.filterClient') || 'לקוח'}
                            </label>
                            <div className="relative">
                              <ClientSelector 
                                  value={clientFilter}
                                  onChange={(val) => setClientFilter(val === clientFilter ? '' : val)}
                                  placeholder={t('tasks.filterClient') || 'הקלד לקוח...'}
                              />
                            </div>
                        </div>
                    </div>

                    {/* Task List */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-zinc-800">
                            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-200">{t('tasks.emptyTitle') || 'אין משימות'}</h3>
                            <p className="text-slate-500 dark:text-zinc-400">{t('tasks.emptyDesc') || 'הכל נקי ומושלם.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {tasks.map((taskItem) => {
                                    const isCompleted = taskItem.status === 'completed';
                                    const cardClasses = `bg-white dark:bg-[#121214] p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md ${isCompleted ? 'border-emerald-200 dark:border-emerald-900/50 opacity-75' : 'border-slate-200 dark:border-zinc-800'}`;
                                    const textClasses = `text-[15px] font-medium leading-normal mb-3 ${isCompleted ? 'text-slate-500 dark:text-zinc-500 line-through' : 'text-slate-900 dark:text-zinc-100'}`;
                                    
                                    let deadlineClasses = 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400';
                                    if (taskItem.deadline && new Date(taskItem.deadline) < new Date() && !isCompleted) {
                                        deadlineClasses = 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400';
                                    }

                                    return (
                                        <motion.div 
                                            key={taskItem.id || Math.random().toString()}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={cardClasses}
                                        >
                                            <div className="flex items-start gap-4 h-full">
                                                <button 
                                                    onClick={() => handleToggleStatus(taskItem)}
                                                    className="mt-1 flex-shrink-0 text-slate-400 hover:text-emerald-500 dark:text-zinc-500 dark:hover:text-emerald-400 transition-colors"
                                                >
                                                    {isCompleted ? (
                                                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                                    ) : (
                                                        <Circle className="w-6 h-6" />
                                                    )}
                                                </button>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col h-full">
                                                    <p className={textClasses}>
                                                        {taskItem.description}
                                                    </p>
                                                    
                                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                                        {taskItem.assignee && (
                                                            <span className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md">
                                                                <User className="w-3.5 h-3.5" />
                                                                {taskItem.assignee}
                                                            </span>
                                                        )}
                                                        {taskItem.deadline && (
                                                            <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${deadlineClasses}`}>
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {formatDate(taskItem.deadline)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="pt-4 mt-auto border-t border-slate-100 dark:border-zinc-800/80">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col gap-1">
                                                                <Link href={getSourceLink(taskItem)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors truncate max-w-[200px]" title={taskItem.title}>
                                                                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="truncate">{taskItem.title || t('knowledgeBase.untitled') || 'ללא כותרת'}</span>
                                                                </Link>
                                                                {taskItem.clientName && (
                                                                    <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500">
                                                                        <Briefcase className="w-3 h-3" />
                                                                        {taskItem.clientName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={() => handleDeleteTask(taskItem.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                                title={t('common.delete') || 'מחק'}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
