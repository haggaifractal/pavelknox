'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc, where, QueryConstraint, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Task } from '@/lib/types/task';
import { CheckCircle2, Circle, Clock, User, Briefcase, Trash2, FileText, Edit2, X, Save, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AssigneeSelector from '@/components/ui/AssigneeSelector';
import ClientSelector from '@/components/ui/ClientSelector';
import TaskComments from '@/components/tasks/TaskComments';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function TasksPage() {
    const { t, language } = useTranslation();
    const { user, permissions, isAdmin } = useAuth();
    
    // Formatting Dates
    const formatDate = (dateValue: any) => {
        try {
            const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
            return new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
                day: '2-digit', month: 'short', year: 'numeric'
            }).format(date);
        } catch (e) {
            return dateValue?.toString() || '';
        }
    };
    
    // Formatting for datetime-local input
    const toDatetimeLocal = (dateValue: any) => {
        if (!dateValue) return '';
        try {
           const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
           return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        } catch(e) { return ''; }
    };
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters with Persistence
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [clientFilters, setClientFilters] = useState<string[]>([]);
    const [assigneeFilter, setAssigneeFilter] = useState<string>('');
    const [isClientSide, setIsClientSide] = useState(false);

    useEffect(() => {
        setIsClientSide(true);
        if (typeof window !== 'undefined') {
            const savedStatus = localStorage.getItem('tasks_status_filter');
            if (savedStatus) setStatusFilter(savedStatus);
            
            const savedClients = localStorage.getItem('tasks_client_filters');
            if (savedClients) {
                try {
                    const parsed = JSON.parse(savedClients);
                    if (Array.isArray(parsed)) setClientFilters(parsed);
                } catch(e){}
            }
        }
    }, []);

    useEffect(() => {
        if (isClientSide) {
            localStorage.setItem('tasks_status_filter', statusFilter);
            localStorage.setItem('tasks_client_filters', JSON.stringify(clientFilters));
        }
    }, [statusFilter, clientFilters, isClientSide]);

    // Editing State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Task>>({});
    
    // Time Tracking State
    const [loggingTimeTaskId, setLoggingTimeTaskId] = useState<string | null>(null);
    const [timeEntryForm, setTimeEntryForm] = useState({minutes: 15, description: '', date: new Date().toISOString().slice(0,10)});
    
    // Bulk Selection
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    useEffect(() => {
        const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
        
        if (statusFilter === 'active') {
            constraints.push(where('status', 'in', ['pending', 'in_progress']));
        } else if (statusFilter !== 'all') {
            constraints.push(where('status', '==', statusFilter));
        }
        
        if (clientFilters.length > 0) {
            const limitedClients = clientFilters.slice(0, 10);
            constraints.push(where('clientName', 'in', limitedClients));
        }
        
        if (assigneeFilter) {
            constraints.push(where('assignee', '==', assigneeFilter));
        }

        const q = query(collection(db, 'tasks'), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Task[] = [];
            const userDeptIds = (user as any)?.departmentIds || [];
            
            snapshot.forEach((d) => {
                const data = d.data();
                if (data.isDeleted === true) return;
                const isGlobal = !data.visibilityScope || data.visibilityScope === 'global';
                const hasIntersection = data.departmentIds?.some((id: string) => userDeptIds.includes(id));
                const isAssignee = data.assigneeId === user?.uid;
                const canView = isAdmin || isGlobal || hasIntersection || isAssignee;

                if (canView) {
                    results.push({ id: d.id, ...data } as Task);
                }
            });
            setTasks(results);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [statusFilter, clientFilters, assigneeFilter]);

    const handleToggleStatus = async (currentTask: Task) => {
        if (!currentTask.id) return;
        const newStatus = currentTask.status === 'completed' ? 'pending' : 'completed';
        try {
            await updateDoc(doc(db, 'tasks', currentTask.id), {
                status: newStatus,
                statusUpdatedAt: new Date(),
                updatedAt: new Date()
            });
            // Audit Log
            const statusKeyMap: Record<string, string> = { pending: 'statusPending', in_progress: 'statusInProgress', completed: 'statusCompleted' };
            const statusKey = statusKeyMap[newStatus] || 'statusPending';
            
            await addDoc(collection(db, `tasks/${currentTask.id}/comments`), {
                text: t('tasks.statusChangeLog').replace('{status}', t(`tasks.${statusKey}`)),
                authorId: user?.uid,
                authorName: user?.displayName || 'Unknown',
                createdAt: new Date(),
                type: 'status_change',
                oldStatus: currentTask.status,
                newStatus: newStatus
            });
        } catch (error) {
            console.error('Failed to update task status:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (!isAdmin || selectedTasks.length === 0) return;
        if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedTasks.length} משימות?`)) return;
        
        try {
            const token = await user?.getIdToken(true);
            const promises = selectedTasks.map(taskId => 
                fetch('/api/tasks/delete', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ id: taskId }),
                })
            );
            
            await Promise.all(promises);
            setSelectedTasks([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error("Bulk delete failed", error);
            alert("שגיאה במחיקת המשימות");
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

    const handleStartEdit = (task: Task) => {
        setEditingTaskId(task.id!);
        setEditForm({
            description: task.description,
            clientName: task.clientName || '',
            assignee: task.assignee || '',
            assigneeId: task.assigneeId || null,
            deadline: task.deadline || null,
            createdAt: task.createdAt,
            status: task.status,
            isBillable: task.isBillable || false
        });
        setTimeEntryForm({minutes: 0, description: '', date: new Date().toISOString().slice(0,10)});
    };

    const handleSaveEdit = async () => {
        if (!editingTaskId) return;
        try {
            const updates: any = {
                description: editForm.description,
                clientName: editForm.clientName,
                assignee: editForm.assignee,
                assigneeId: editForm.assigneeId || null,
                deadline: editForm.deadline,
                status: editForm.status,
                isBillable: editForm.isBillable || false,
                updatedAt: new Date()
            };
            
            // Check if we should add a time entry alongside this edit
            if (editForm.isBillable && timeEntryForm.minutes > 0) {
                if (!editForm.clientName) {
                    alert("חובה לשייך את המשימה ללקוח לפני דיווח שעות.");
                    return;
                }
                const newEntry = {
                    id: crypto.randomUUID(),
                    userId: user?.uid || 'unknown',
                    userName: user?.displayName || user?.email?.split('@')[0] || 'Unknown',
                    date: timeEntryForm.date,
                    minutes: Number(timeEntryForm.minutes),
                    description: timeEntryForm.description
                };
                
                const taskOriginal = tasks.find(t => t.id === editingTaskId);
                const currentEntries = taskOriginal?.timeEntries || [];
                const currentTotal = taskOriginal?.totalLoggedMinutes || 0;
                
                updates.timeEntries = [...currentEntries, newEntry];
                updates.totalLoggedMinutes = currentTotal + newEntry.minutes;
            }
            
            if (editForm.createdAt && !(editForm.createdAt as any).toDate) {
                updates.createdAt = new Date(editForm.createdAt);
            }

            await updateDoc(doc(db, 'tasks', editingTaskId), updates);
            setEditingTaskId(null);
            setEditForm({});
            setTimeEntryForm({minutes: 0, description: '', date: new Date().toISOString().slice(0,10)});
        } catch(e) {
            console.error("Error saving task", e);
            alert("שגיאה בשמירת המשימה");
        }
    };

    // Removed handleAddTimeEntry as it's now part of handleSaveEdit

    const handleAddTimeEntryOnly = async (taskId: string) => {
        if (!timeEntryForm.minutes || timeEntryForm.minutes <= 0) return;
        try {
            const taskOriginal = tasks.find(t => t.id === taskId);
            if (!taskOriginal) return;

            if (!taskOriginal.clientName) {
                alert("חובה לשייך את המשימה ללקוח בעריכת המשימה לפני דיווח שעות.");
                return;
            }

            const newEntry = {
                id: crypto.randomUUID(),
                userId: user?.uid || 'unknown',
                userName: user?.displayName || user?.email?.split('@')[0] || 'Unknown',
                date: timeEntryForm.date,
                minutes: Number(timeEntryForm.minutes),
                description: timeEntryForm.description
            };

            const currentEntries = taskOriginal.timeEntries || [];
            const currentTotal = taskOriginal.totalLoggedMinutes || 0;

            const updates = {
                timeEntries: [...currentEntries, newEntry],
                totalLoggedMinutes: currentTotal + newEntry.minutes,
                updatedAt: new Date()
            };

            await updateDoc(doc(db, 'tasks', taskId), updates);
            setLoggingTimeTaskId(null);
            setTimeEntryForm({minutes: 15, description: '', date: new Date().toISOString().slice(0,10)});
        } catch(e) {
            console.error("Error adding time", e);
            alert("שגיאה בהוספת זמן");
        }
    };

    const handleDeleteTimeEntry = async (taskId: string, entryId: string, minutesToDeduct: number) => {
        if (!confirm(t('tasks.confirmDeleteTimeEntry'))) return;
        try {
            const taskRef = doc(db, 'tasks', taskId);
            const taskDoc = await getDoc(taskRef);
            if (taskDoc.exists()) {
                const data = taskDoc.data();
                const currentEntries = data.timeEntries || [];
                const updatedEntries = currentEntries.filter((e: any) => e.id !== entryId);
                const newTotal = updatedEntries.reduce((sum: number, entry: any) => sum + entry.minutes, 0);
                
                await updateDoc(taskRef, {
                    timeEntries: updatedEntries,
                    totalLoggedMinutes: newTotal,
                    updatedAt: new Date()
                });

                await addDoc(collection(db, `tasks/${taskId}/comments`), {
                    text: t('tasks.timeEntryDeletedLog').replace('{minutes}', minutesToDeduct.toString()),
                    authorId: user?.uid,
                    authorName: user?.displayName || user?.email?.split('@')[0] || t('tasks.defaultUser'),
                    createdAt: new Date(),
                    type: 'time_deleted'
                });
            }
        } catch (error) {
            console.error('Error deleting time entry:', error);
            alert(t('tasks.errorDeleteTimeEntry'));
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
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                                    {t('tasks.title') || 'מרכז משימות'}
                                </h1>
                                <p className="text-slate-500 dark:text-zinc-400 mt-2">
                                    {t('tasks.subtitle') || 'ניהול ובקרה על פריטי פעולה מכלל המסמכים.'}
                                </p>
                            </div>
                            {isAdmin && (
                                <div className="flex flex-col items-end gap-2">
                                    <button 
                                        onClick={() => {
                                            setIsSelectionMode(!isSelectionMode);
                                            if (isSelectionMode) setSelectedTasks([]);
                                        }}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isSelectionMode ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                    >
                                        {isSelectionMode ? 'ביטול מחיקה מרובה' : 'מחיקה מרובה'}
                                    </button>
                                    
                                    {isSelectionMode && selectedTasks.length > 0 && (
                                        <button 
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            מחק {selectedTasks.length} משימות
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-white dark:bg-zinc-900/50 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                        
                        {/* Status Filter */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                {t('tasks.filterStatus') || 'סטטוס משימה'}
                            </label>
                            
                            {/* Mobile Dropdown */}
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full sm:hidden bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-zinc-200 outline-none"
                            >
                                <option value="all">הכל</option>
                                <option value="active">פעילים (לא הושלמו)</option>
                                <option value="completed">הושלמו בלבד</option>
                            </select>

                            {/* Desktop Buttons */}
                            <div className="hidden sm:flex gap-2">
                                {[
                                    { value: 'all', label: 'הכל' },
                                    { value: 'active', label: 'פעילים' },
                                    { value: 'completed', label: 'הושלם' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setStatusFilter(opt.value)}
                                        className={`flex-1 px-3 py-2 text-[13px] font-medium rounded-xl transition-all outline-none ${statusFilter === opt.value ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20' : 'bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assignee Filter */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                {t('tasks.filterAssignee') || 'אחראי'}
                            </label>
                            <AssigneeSelector 
                                value={assigneeFilter}
                                onChange={(valObj) => setAssigneeFilter(valObj.displayName === assigneeFilter ? '' : valObj.displayName)}
                                placeholder="הקלד שם אחראי לסינון..."
                                className="bg-slate-50 dark:bg-zinc-950"
                            />
                        </div>

                        {/* Client Filter */}
                        <div className="z-20">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {t('tasks.filterClient') || 'לפי לקוחות'}
                            </label>
                            <div className="flex flex-col gap-2">
                                {clientFilters.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {clientFilters.map(c => (
                                            <span key={c} className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                                                <span className="truncate max-w-[100px]">{c}</span>
                                                <button 
                                                    onClick={() => setClientFilters(p => p.filter(x => x !== c))}
                                                    className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-full transition-colors"
                                                >
                                                    <X className="w-3 h-3"/>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="relative">
                                  <ClientSelector 
                                      value={""}
                                      onChange={(val) => {
                                          if (val && !clientFilters.includes(val)) {
                                              if (clientFilters.length >= 10) {
                                                  alert('לא ניתן לסנן יותר מ-10 לקוחות בו זמנית');
                                                  return;
                                              }
                                              setClientFilters(p => [...p, val]);
                                          }
                                      }}
                                      placeholder="הוסף לקוח לסינון..."
                                  />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task List */}
                    {loading || (!isClientSide) ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-zinc-800">
                            <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-200">{t('tasks.emptyTitle') || 'אין משימות'}</h3>
                            <p className="text-slate-500 dark:text-zinc-400">{t('tasks.emptyDesc') || 'הכל נקי ומושלם.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {tasks.map((taskItem) => {
                                    const isEditing = editingTaskId === taskItem.id;
                                    const isCompleted = taskItem.status === 'completed';
                                    const cardClasses = `bg-white dark:bg-[#121214] p-6 rounded-3xl border shadow-sm transition-all relative group flex flex-col ${isCompleted ? 'border-emerald-200 dark:border-emerald-900/50 opacity-80 bg-slate-50/50 dark:bg-zinc-950' : 'border-slate-200 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-zinc-700 hover:shadow-md'}`;
                                    
                                    let deadlineClasses = 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20';
                                    if (taskItem.deadline && new Date(taskItem.deadline) < new Date() && !isCompleted) {
                                        deadlineClasses = 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 font-bold';
                                    }

                                    const isAssignee = taskItem.assigneeId === user?.uid;
                                    const canToggleStatus = true;
                                    const canEditFullTask = true;

                                    if (isEditing) {
                                        return (
                                            <motion.div 
                                                key={taskItem.id}
                                                layout
                                                className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-indigo-500 shadow-xl flex flex-col gap-4 z-10"
                                            >
                                                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3 mb-1">
                                                    <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">{t('tasks.editTaskTitle')}</h3>
                                                    <button onClick={() => setEditingTaskId(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition">
                                                        <X className="w-5 h-5"/>
                                                    </button>
                                                </div>

                                                <textarea 
                                                    value={editForm.description || ''}
                                                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                                                    disabled={!canEditFullTask}
                                                    className={`w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none min-h-[80px] outline-none ${!canEditFullTask ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                    placeholder={t('tasks.taskDescPlaceholder')}
                                                />

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{t('tasks.deadline')}</label>
                                                        <input 
                                                            type="datetime-local"
                                                            value={toDatetimeLocal(editForm.deadline)}
                                                            onChange={e => setEditForm({...editForm, deadline: e.target.value})}
                                                            disabled={!canEditFullTask}
                                                            className={`w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500 ${!canEditFullTask ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{t('tasks.client')}</label>
                                                        <ClientSelector 
                                                            value={editForm.clientName || ''}
                                                            onChange={val => setEditForm({...editForm, clientName: val})}
                                                            readOnly={!canEditFullTask}
                                                            placeholder={t('tasks.selectClient')}
                                                            className={`bg-slate-50 dark:bg-zinc-950 text-[13px] ${!canEditFullTask ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="z-10 relative">
                                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{t('tasks.assignee')}</label>
                                                        <AssigneeSelector 
                                                            value={editForm.assignee}
                                                            onChange={vObj => setEditForm({...editForm, assignee: vObj.displayName, assigneeId: vObj.uid})}
                                                            readOnly={!canEditFullTask}
                                                            className={`bg-slate-50 dark:bg-zinc-950 text-sm ${!canEditFullTask ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">{t('tasks.status')}</label>
                                                        <select
                                                            value={editForm.status}
                                                            onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                                                            className="w-full h-[40px] bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500"
                                                        >
                                                            <option value="pending">{t('tasks.statusPending')}</option>
                                                            <option value="in_progress">{t('tasks.statusInProgress')}</option>
                                                            <option value="completed">{t('tasks.statusCompleted')}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`billable-${taskItem.id}`}
                                                            checked={editForm.isBillable || false}
                                                            onChange={e => setEditForm({...editForm, isBillable: e.target.checked})}
                                                            disabled={!canEditFullTask}
                                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                        />
                                                        <label htmlFor={`billable-${taskItem.id}`} className="text-sm font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                                                            {t('tasks.billableTask')}
                                                        </label>
                                                    </div>
                                                    
                                                    {editForm.isBillable && (
                                                        <div className="mt-3 p-3 bg-indigo-50/50 dark:bg-zinc-900/30 border border-indigo-100 dark:border-zinc-800 rounded-lg">
                                                            <h5 className="text-[13px] font-semibold text-indigo-800 dark:text-indigo-400 mb-3">
                                                                {t('tasks.addTimeEntryTitle')}
                                                            </h5>
                                                            <div className="space-y-3">
                                                                <div className="flex gap-2">
                                                                    <input 
                                                                        type="date" 
                                                                        value={timeEntryForm.date}
                                                                        onChange={e => setTimeEntryForm({...timeEntryForm, date: e.target.value})}
                                                                        className="flex-1 text-xs p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                    />
                                                                    <select 
                                                                        value={timeEntryForm.minutes}
                                                                        onChange={e => setTimeEntryForm({...timeEntryForm, minutes: Number(e.target.value)})}
                                                                        className="w-28 text-xs p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                    >
                                                                        <option value={0}>{t('tasks.minutes0')}</option>
                                                                        <option value={15}>{t('tasks.minutes15')}</option>
                                                                        <option value={30}>{t('tasks.minutes30')}</option>
                                                                        <option value={45}>{t('tasks.minutes45')}</option>
                                                                        <option value={60}>{t('tasks.minutes60')}</option>
                                                                        <option value={90}>{t('tasks.minutes90')}</option>
                                                                        <option value={120}>{t('tasks.minutes120')}</option>
                                                                        <option value={150}>{t('tasks.minutes150') || 'שעתיים וחצי'}</option>
                                                                        <option value={180}>{t('tasks.minutes180') || '3 שעות'}</option>
                                                                        <option value={210}>{t('tasks.minutes210') || '3.5 שעות'}</option>
                                                                        <option value={240}>{t('tasks.minutes240') || '4 שעות'}</option>
                                                                        <option value={270}>{t('tasks.minutes270') || '4.5 שעות'}</option>
                                                                        <option value={300}>{t('tasks.minutes300') || '5 שעות'}</option>
                                                                        <option value={330}>{t('tasks.minutes330') || '5.5 שעות'}</option>
                                                                        <option value={360}>{t('tasks.minutes360') || '6 שעות'}</option>
                                                                    </select>
                                                                </div>
                                                                <input 
                                                                    type="text"
                                                                    placeholder={t('tasks.timeEntryDescPlaceholder')}
                                                                    value={timeEntryForm.description}
                                                                    onChange={e => setTimeEntryForm({...timeEntryForm, description: e.target.value})}
                                                                    className="w-full text-xs p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" />
                                                        {t('tasks.activityAndComments')}
                                                    </h4>
                                                    <div className="h-[250px]">
                                                        <TaskComments taskId={taskItem.id!} />
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex gap-3">
                                                    <button onClick={handleSaveEdit} className="flex-1 flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-zinc-900">
                                                        <Save className="w-4 h-4"/> {t('tasks.save')}
                                                    </button>
                                                    <button onClick={() => setEditingTaskId(null)} className="flex-1 flex justify-center items-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 py-2.5 rounded-xl font-medium text-sm transition-colors hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-sm outline-none">
                                                        {t('tasks.cancel')}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        );
                                    }

                                    return (
                                        <motion.div 
                                            key={taskItem.id || Math.random().toString()}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className={`${cardClasses} ${isSelectionMode ? 'cursor-pointer' : ''} ${isSelectionMode && selectedTasks.includes(taskItem.id!) ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}
                                            onClick={() => {
                                                if (isSelectionMode && taskItem.id) {
                                                    setSelectedTasks(prev => 
                                                        prev.includes(taskItem.id!) 
                                                            ? prev.filter(id => id !== taskItem.id)
                                                            : [...prev, taskItem.id!]
                                                    );
                                                }
                                            }}
                                        >
                                            {isSelectionMode && (
                                                <div className="absolute top-4 rtl:left-4 ltr:right-4 z-10 text-indigo-600">
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selectedTasks.includes(taskItem.id!) ? 'bg-indigo-600 border border-indigo-600 text-white' : 'border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'}`}>
                                                        {selectedTasks.includes(taskItem.id!) && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                                                    </div>
                                                </div>
                                            )}

                                            {!isSelectionMode && (
                                              <div className="absolute top-4 ltr:right-4 rtl:left-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                  {(canEditFullTask || isAssignee) && (
                                                      <button 
                                                          onClick={() => handleStartEdit(taskItem)}
                                                          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors outline-none"
                                                          title={canEditFullTask ? t('tasks.editTask') : t('tasks.viewTaskAndComments')}
                                                      >
                                                          <Edit2 className="w-4 h-4" />
                                                      </button>
                                                  )}
                                                {isAdmin && (
                                                    <button 
                                                        onClick={() => handleDeleteTask(taskItem.id!)}
                                                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors outline-none"
                                                        title={t('tasks.deleteTask')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                              </div>
                                            )}

                                            <div className="flex items-start gap-3.5 mb-4 ltr:pr-20 rtl:pl-20">
                                                <button 
                                                    onClick={() => canToggleStatus && handleToggleStatus(taskItem)}
                                                    className={`mt-0.5 flex-shrink-0 transition-colors outline-none ${canToggleStatus ? 'text-slate-300 hover:text-emerald-500 dark:text-zinc-600 dark:hover:text-emerald-400 cursor-pointer' : 'text-slate-200 dark:text-zinc-700 cursor-default'}`}
                                                >
                                                    {isCompleted ? (
                                                        <CheckCircle2 className={`w-[22px] h-[22px] ${canToggleStatus ? 'text-emerald-500 drop-shadow-sm' : 'text-slate-300 dark:text-zinc-600'}`} />
                                                    ) : (
                                                        <Circle className="w-[22px] h-[22px]" />
                                                    )}
                                                </button>
                                                
                                                <p className={`text-[15px] leading-relaxed flex-1 pt-0.5 ${isCompleted ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-slate-800 dark:text-zinc-200 font-medium'}`}>
                                                    {taskItem.description}
                                                </p>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2 mb-5">
                                                {taskItem.assignee && (
                                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 px-2 py-1 rounded-md shadow-sm">
                                                        <User className="w-3.5 h-3.5" />
                                                        {taskItem.assignee}
                                                    </span>
                                                )}
                                                {taskItem.deadline && (
                                                    <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md shadow-sm ${deadlineClasses}`}>
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatDate(taskItem.deadline)}
                                                    </span>
                                                )}
                                            </div>

                                            {taskItem.isBillable && (
                                                <div className="mt-2 mb-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-3 border border-slate-100 dark:border-zinc-800">
                                                    <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                                            <span>{t('tasks.timeLogged')}: {taskItem.totalLoggedMinutes ? `${Math.floor(taskItem.totalLoggedMinutes / 60).toString().padStart(2, '0')}:${(taskItem.totalLoggedMinutes % 60).toString().padStart(2, '0')}` : '00:00'}</span>
                                                        </div>
                                                        {loggingTimeTaskId !== taskItem.id && canEditFullTask && (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setLoggingTimeTaskId(taskItem.id!);
                                                                    setTimeEntryForm({minutes: 15, description: '', date: new Date().toISOString().slice(0,10)});
                                                                }} 
                                                                className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md transition-colors text-[11px] focus:outline-none"
                                                            >
                                                                + {t('tasks.addTimeEntryTitle') || 'הוסף זמן'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {taskItem.timeEntries && taskItem.timeEntries.length > 0 && (
                                                        <div className="mt-3 space-y-1.5 border-t border-slate-200/50 dark:border-zinc-800/50 pt-3">
                                                            {taskItem.timeEntries.map((entry, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 bg-white/60 dark:bg-zinc-950/40 p-1.5 rounded-md px-2 border border-slate-100 dark:border-zinc-800/80">
                                                                    <div className="flex flex-wrap items-center gap-1.5 rtl:space-x-reverse">
                                                                        <span className="font-medium text-slate-700 dark:text-zinc-300" dir="auto">{entry.userName}</span>
                                                                        <span className="text-slate-300 dark:text-zinc-700 text-[9px] px-0.5">•</span>
                                                                        <span className="opacity-75" dir="ltr">{new Date(entry.date).toLocaleDateString('he-IL')}</span>
                                                                        {entry.description && (
                                                                            <>
                                                                                <span className="text-slate-300 dark:text-zinc-700 text-[9px] px-0.5">•</span>
                                                                                <span className="text-slate-500 dark:text-zinc-400 max-w-[120px] truncate" title={entry.description} dir="auto">
                                                                                    {entry.description}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                                                            {Math.floor(entry.minutes / 60).toString().padStart(2, '0')}:{(entry.minutes % 60).toString().padStart(2, '0')} h
                                                                        </span>
                                                                        {(isAdmin || user?.uid === entry.userId) && entry.id && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteTimeEntry(taskItem.id!, entry.id, entry.minutes);
                                                                                }}
                                                                                className="text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors p-0.5 focus:outline-none"
                                                                                title={t('tasks.deleteTimeEntryTooltip')}
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <AnimatePresence>
                                                        {loggingTimeTaskId === taskItem.id && (
                                                            <motion.div 
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden mt-3 pt-3 border-t border-slate-200 dark:border-zinc-800"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex gap-2">
                                                                        <input 
                                                                            type="date" 
                                                                            value={timeEntryForm.date}
                                                                            onChange={e => setTimeEntryForm({...timeEntryForm, date: e.target.value})}
                                                                            className="w-1/2 text-[11px] p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                        />
                                                                        <select 
                                                                            value={timeEntryForm.minutes}
                                                                            onChange={e => setTimeEntryForm({...timeEntryForm, minutes: Number(e.target.value)})}
                                                                            className="w-1/2 text-[11px] p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                        >
                                                                            <option value={15}>{t('tasks.minutes15') || '15 דק’'}</option>
                                                                            <option value={30}>{t('tasks.minutes30') || '30 דק’'}</option>
                                                                            <option value={45}>{t('tasks.minutes45') || '45 דק’'}</option>
                                                                            <option value={60}>{t('tasks.minutes60') || 'שעה 1'}</option>
                                                                            <option value={90}>{t('tasks.minutes90') || 'שעה וחצי'}</option>
                                                                            <option value={120}>{t('tasks.minutes120') || 'שעתיים'}</option>
                                                                            <option value={150}>{t('tasks.minutes150') || 'שעתיים וחצי'}</option>
                                                                            <option value={180}>{t('tasks.minutes180') || '3 שעות'}</option>
                                                                            <option value={210}>{t('tasks.minutes210') || '3.5 שעות'}</option>
                                                                            <option value={240}>{t('tasks.minutes240') || '4 שעות'}</option>
                                                                            <option value={270}>{t('tasks.minutes270') || '4.5 שעות'}</option>
                                                                            <option value={300}>{t('tasks.minutes300') || '5 שעות'}</option>
                                                                            <option value={330}>{t('tasks.minutes330') || '5.5 שעות'}</option>
                                                                            <option value={360}>{t('tasks.minutes360') || '6 שעות'}</option>
                                                                        </select>
                                                                    </div>
                                                                    <input 
                                                                        type="text"
                                                                        placeholder={t('tasks.timeEntryDescPlaceholder') || 'תיאור (אופציונלי)'}
                                                                        value={timeEntryForm.description}
                                                                        onChange={e => setTimeEntryForm({...timeEntryForm, description: e.target.value})}
                                                                        className="w-full text-[11px] p-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                    />
                                                                    <div className="flex justify-end gap-2 mt-1">
                                                                        <button 
                                                                            onClick={() => setLoggingTimeTaskId(null)} 
                                                                            className="px-3 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
                                                                        >
                                                                            ביטול
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleAddTimeEntryOnly(taskItem.id!)} 
                                                                            className="px-3 py-1 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-zinc-900"
                                                                        >
                                                                            שמור
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}

                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800/80">
                                                <div className="flex flex-col gap-2">
                                                    <Link href={getSourceLink(taskItem)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors group/link w-fit">
                                                        <FileText className="w-3.5 h-3.5 flex-shrink-0 group-hover/link:text-indigo-500 transition-colors" />
                                                        <span className="truncate max-w-[220px]">{taskItem.title || t('knowledgeBase.untitled') || 'ללא כותרת'}</span>
                                                    </Link>
                                                    <div className="flex justify-between items-center w-full">
                                                        {taskItem.clientName ? (
                                                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
                                                                <Briefcase className="w-3.5 h-3.5" />
                                                                <span className="truncate max-w-[150px]">{taskItem.clientName}</span>
                                                            </span>
                                                        ) : <div/>}

                                                        <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-medium">
                                                            נוצר: {formatDate(taskItem.createdAt)}
                                                        </span>
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
