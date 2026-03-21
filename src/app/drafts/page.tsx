'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { usePendingDrafts, Draft } from '@/lib/hooks/usePendingDrafts';
import { useState } from 'react';
import { 
    LogOut, Database, FileText, ChevronDown, 
    Edit3, Trash2, Mic, Bot, Calendar, Clock, Lock, RefreshCcw, Loader2, BookOpen, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, parseMarkdown, stripMarkdown } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import DashboardFilters from '@/components/ui/DashboardFilters';
import BulkActionBar from '@/components/ui/BulkActionBar';
import MergeDraftsModal from '@/components/ui/MergeDraftsModal';
import TagSelector from '@/components/ui/TagSelector';
import ClientSelector from '@/components/ui/ClientSelector';

export default function DraftsPage() {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const router = useRouter();
    const [filterStatus, setFilterStatus] = useState<string>('pending');
    const [filterTag, setFilterTag] = useState<string>('');
    const { drafts, loading, loadingMore, hasMore, error, loadMore, refresh } = usePendingDrafts({ status: filterStatus, tagId: filterTag });
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastPosition, setToastPosition] = useState<{top: string, left?: string, right?: string} | null>(null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const { t } = useTranslation();

    const handleDisabledSelection = (e: React.MouseEvent) => {
        const x = e.clientX;
        const y = e.clientY;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
        
        // Compute position pushing away from the nearest edge perfectly
        let positionProps: { top: string, left?: string, right?: string } = {
            top: `${Math.max(10, y - 65)}px`
        };

        if (x < windowWidth / 2) {
            positionProps.left = `${Math.max(10, x - 20)}px`;
        } else {
            positionProps.right = `${Math.max(10, windowWidth - x - 20)}px`;
        }

        setToastPosition(positionProps);
        setToastMessage(t('dashboard.mergeSelectionError'));
        setTimeout(() => {
            setToastMessage(null);
            setToastPosition(null);
        }, 2500);
    };

    // Conflict prevention logic for selection
    const firstSelectedDraft = drafts.find(d => selectedDraftIds.has(d.id));
    const baseClientName = firstSelectedDraft?.clientName;
    const baseStatus = firstSelectedDraft?.status;

    const canSelect = (draft: Draft) => {
        if (selectedDraftIds.size === 0) return true;
        if (selectedDraftIds.has(draft.id)) return true;
        // Check for matching client name (to prevent mixing data) AND status
        return draft.clientName === baseClientName && draft.status === baseStatus;
    };

    const toggleSelection = (e: React.SyntheticEvent, id: string) => {
        e.stopPropagation();
        const newSet = new Set(selectedDraftIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDraftIds(newSet);
    };

    const selectableDrafts = drafts.filter(canSelect);
    const isAllSelected = selectableDrafts.length > 0 && selectableDrafts.every(d => selectedDraftIds.has(d.id));
    const isIndeterminate = selectedDraftIds.size > 0 && !isAllSelected;

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isAllSelected) {
            setSelectedDraftIds(new Set());
        } else {
            const newSet = new Set(selectedDraftIds);
            selectableDrafts.forEach(d => newSet.add(d.id));
            setSelectedDraftIds(newSet);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(t('dashboard.confirmBulkDelete') || 'Are you sure you want to delete the selected items?')) return;
        try {
            const batch = writeBatch(db);
            selectedDraftIds.forEach(id => {
                batch.delete(doc(db, 'drafts', id));
            });
            await batch.commit();
            setSelectedDraftIds(new Set());
            refresh();
        } catch (error) {
            console.error('Failed to bulk delete drafts', error);
            alert(t('common.error'));
        }
    };

    const handleBulkMerge = () => {
        setIsMergeModalOpen(true);
    };

    const executeMerge = async (mergedData: Partial<Draft>) => {
        try {
            const batch = writeBatch(db);
            
            // 1. Create the new merged draft
            const newDraftRef = doc(collection(db, 'drafts'));
            batch.set(newDraftRef, {
                ...mergedData,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // 2. Delete the old selected drafts
            selectedDraftIds.forEach(id => {
                const draftRef = doc(db, 'drafts', id);
                batch.delete(draftRef);
            });

            // 3. Commit atomic operations
            await batch.commit();
            setSelectedDraftIds(new Set());
            setIsMergeModalOpen(false);
            refresh();
        } catch (error) {
            console.error('Failed to execute bulk merge', error);
            alert(t('common.error'));
            throw error;
        }
    };

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    const handleDelete = async (draftId: string) => {
        try {
            const tasksQuery = query(collection(db, 'tasks'), where('sourceId', '==', draftId));
            const tasksSnap = await getDocs(tasksQuery);
            
            if (!tasksSnap.empty) {
                const openTasks = tasksSnap.docs.filter(doc => {
                    const status = doc.data().status;
                    return status === 'pending' || status === 'in_progress';
                });
                
                if (openTasks.length > 0) {
                    const confirmMsg = t('drafts.warnTasksDelete') || `⚠️ שים לב: לטיוטה זו מקושרות ${openTasks.length} משימות פעילות. מחיקת הטיוטה תמחק גם את המשימות הללו. האם אתה בטוח שברצונך למחוק?`;
                    if (!confirm(confirmMsg)) return;
                } else {
                    if (!confirm(t('dashboard.confirmDelete'))) return;
                }
            } else {
                if (!confirm(t('dashboard.confirmDelete'))) return;
            }

            const token = await user?.getIdToken();
            const res = await fetch('/api/drafts/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: draftId })
            });
            if (!res.ok) throw new Error('Failed to delete draft');
            refresh();
        } catch (error) {
            console.error('Failed to delete draft', error);
            alert(t('common.error'));
        }
    };

    const handleInlineUpdate = async (id: string, field: string, value: any, fullDraft?: Draft) => {
        // Fast-Approve from Dashboard
        if (field === 'status' && value === 'approved' && fullDraft) {
            if (!confirm('Are you sure you want to approve this directly? It will be processed and moved to the Knowledge Base.')) return;
            try {
                // 1. Clean up old resources if any
                const token = await user?.getIdToken();
                
                if (fullDraft.sourceKnowledgeId) {
                    await fetch('/api/knowledge/delete', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ id: fullDraft.sourceKnowledgeId })
                    }).catch(console.error);
                }

                const finalTitle = fullDraft.title || fullDraft.clientName || 'Untitled';
                const finalContent = fullDraft.text || '';
                
                // 2. Move to Knowledge Base
                const kbDocRef = await addDoc(collection(db, 'knowledge_base'), {
                    title: finalTitle,
                    content: finalContent,
                    clientName: fullDraft.clientName || '',
                    tags: fullDraft.tags || [],
                    sourceDraftId: id,
                    publishedAt: new Date()
                });

                // Update any associated tasks to point to the new knowledge base document
                try {
                    const tasksQuery = query(collection(db, 'tasks'), where('sourceId', '==', id));
                    const tasksSnap = await getDocs(tasksQuery);
                    if (!tasksSnap.empty) {
                        const batchPromises = tasksSnap.docs.map(taskDoc => 
                            updateDoc(doc(db, 'tasks', taskDoc.id), {
                                sourceId: kbDocRef.id,
                                sourceType: 'knowledge_base',
                                sourceUrl: `/knowledge/${kbDocRef.id}`,
                                updatedAt: new Date()
                            })
                        );
                        await Promise.all(batchPromises);
                        console.log(`Updated ${tasksSnap.size} tasks to point to new knowledge base document.`);
                    }
                } catch(e) {
                    console.error('Failed to update tasks source info', e);
                }

                // 3. Auto-ingest into RAG
                await fetch('/api/knowledge/ingest', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: finalTitle,
                        content: finalContent,
                        clientName: fullDraft.clientName || '',
                        tags: fullDraft.tags || [],
                        type: 'approved_draft',
                        sourceUrl: `/knowledge/${kbDocRef.id}`
                    })
                });

                // 4. Delete the Draft (Securely)
                const deleteRes = await fetch('/api/drafts/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id })
                });
                if (!deleteRes.ok) throw new Error('Failed to securely delete draft during approval');
                refresh();
                return;
            } catch (err) {
                console.error('Fast approve failed', err);
                alert(t('common.error'));
                return;
            }
        }

        // Standard inline updates
        try {
            await updateDoc(doc(db, 'drafts', id), {
                [field]: value,
                updatedAt: new Date()
            });
            refresh();
        } catch (error) {
            console.error(`Failed to update draft ${id} field ${field}`, error);
            alert(t('common.error'));
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants: import('framer-motion').Variants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans transition-colors duration-300 selection:bg-indigo-500/30">
                
                {/* Page Content */}

                <main className="max-w-[1600px] w-full mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
                    
                    {/* Header Section */}
                    <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-20">
                        <div>
                            <motion.h1 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight transition-colors"
                            >
                                {t('dashboard.title')}
                            </motion.h1>
                        </div>
                        
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap"
                        >
                            {isSuperAdmin && (
                                <button
                                    onClick={() => router.push('/settings')}
                                    className="inline-flex items-center h-10 px-5 border border-amber-200 dark:border-amber-500/20 text-[13px] font-semibold rounded-xl text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 w-full sm:w-auto justify-center"
                                >
                                    <Lock className="w-4 h-4 rtl:ml-2 ltr:mr-2 opacity-70" aria-hidden="true" />
                                    {t('settings.title') || 'Team Settings'}
                                </button>
                            )}

                            <button
                                onClick={() => router.push('/')}
                                className="inline-flex items-center h-10 px-5 border border-slate-200 dark:border-zinc-800 text-[13px] font-semibold rounded-xl text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900/50 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 w-full sm:w-auto justify-center"
                                aria-label={t('dashboard.btnKnowledgeBase')}
                            >
                                <BookOpen className="w-4 h-4 rtl:ml-2 ltr:mr-2 opacity-70" aria-hidden="true" />
                                {t('dashboard.btnKnowledgeBase')}
                            </button>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <div className="h-10 px-4 flex-1 sm:flex-none inline-flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl text-[13px] font-bold shadow-sm" aria-live="polite">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 rtl:ml-2 ltr:mr-2 animate-pulse" aria-hidden="true"></div>
                                    {t('dashboard.draftsCount').replace('{count}', drafts.length.toString())}
                                </div>
                                <button
                                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                                    className={cn(
                                        "sm:hidden flex items-center justify-center h-10 w-10 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-xl focus:outline-none shrink-0 transition-colors",
                                        showMobileFilters ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20" : "bg-white dark:bg-zinc-900/50 text-slate-700 dark:text-zinc-300"
                                    )}
                                >
                                    <Filter className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </header>

                    {/* Filters */}
                    <div className={cn("flex-col gap-6 relative z-10 w-full mb-6", showMobileFilters ? "flex" : "hidden sm:flex")}>
                        <DashboardFilters 
                            status={filterStatus}
                            onStatusChange={setFilterStatus}
                            tagId={filterTag}
                            onTagChange={setFilterTag}
                        />
                    </div>

                    {/* Content Section */}
                    {loading && drafts.length === 0 ? (
                        <div className="flex justify-center items-center h-64" aria-live="polite" aria-busy="true">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 dark:bg-red-950/20 border-s-4 border-red-500 p-6 rounded-e-xl" aria-live="assertive">
                            <div className="flex">
                                <div className="rtl:mr-3 ltr:ml-3">
                                    <h3 className="text-sm font-bold text-red-800 dark:text-red-400">{t('common.error')}</h3>
                                    <div className="mt-2 text-[13px] text-red-700 dark:text-red-300">{error.message}</div>
                                </div>
                            </div>
                        </div>
                    ) : drafts.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-zinc-900/40 border border-dashed border-slate-300 dark:border-zinc-800 rounded-3xl p-16 text-center max-w-2xl mx-auto backdrop-blur-sm transition-colors"
                        >
                            <div className="mx-auto h-20 w-20 bg-slate-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100 dark:border-zinc-800/50">
                                <FileText className="h-8 w-8 text-slate-400 dark:text-zinc-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-[17px] font-bold text-slate-800 dark:text-zinc-100 mb-2">{t('dashboard.noDraftsTitle')}</h3>
                            <p className="text-[15px] text-slate-500 dark:text-zinc-500 leading-relaxed max-w-md mx-auto">
                                {t('dashboard.noDraftsDesc')}
                            </p>
                        </motion.div>
                    ) : (
                        <div className="bg-white dark:bg-[#0c0c0e] rounded-2xl shadow-sm dark:shadow-2xl dark:shadow-black/50 border border-slate-200 dark:border-zinc-800/60 overflow-hidden backdrop-blur-md relative transition-colors">
                            {/* Decorative glass border top */}
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-700/50 to-transparent" />
                            
                            {/* Table Header */}
                            <div className="hidden lg:grid grid-cols-12 gap-4 p-5 bg-slate-50/80 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800/60 text-[11px] font-extrabold text-slate-500 dark:text-zinc-500 uppercase tracking-widest transition-colors backdrop-blur-md sticky top-0 z-10">
                                <div className="col-span-1 flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        checked={isAllSelected}
                                        ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
                                        disabled={drafts.length === 0}
                                        aria-label={t('common.selectAll') || 'Select All'}
                                    />
                                </div>
                                <div className="col-span-3 rtl:pr-2 ltr:pl-2">{t('dashboard.tableHeaderSource')}</div>
                                <div className="col-span-4">{t('dashboard.tableHeaderAI')}</div>
                                <div className="col-span-2">{t('dashboard.tableHeaderStatus')}</div>
                                <div className="col-span-2 text-start">{t('dashboard.tableHeaderActions')}</div>
                            </div>

                            {/* Table Body */}
                            <motion.ul 
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                className="divide-y divide-slate-100 dark:divide-zinc-800/60"
                            >
                                <AnimatePresence>
                                    {drafts.map((draft) => {
                                        const isExpanded = expandedRows.has(draft.id);
                                        const isAudio = !!draft.audioFileId;
                                        const isSelected = selectedDraftIds.has(draft.id);
                                        const isSelectable = canSelect(draft);
                                        
                                        return (
                                            <motion.li 
                                                key={draft.id}
                                                variants={itemVariants}
                                                className={cn(
                                                    "group transition-all duration-300 relative",
                                                    isExpanded ? "bg-slate-50/50 dark:bg-zinc-900/20" : "hover:bg-slate-50/30 dark:hover:bg-zinc-900/10",
                                                )}
                                            >
                                                {/* Side accent border on hover/expand */}
                                                <div className={cn(
                                                    "absolute rtl:right-0 ltr:left-0 top-0 bottom-0 w-1 rounded-s transition-colors",
                                                    isExpanded ? "bg-indigo-500 dark:bg-indigo-500" : "bg-transparent group-hover:bg-indigo-200 dark:group-hover:bg-zinc-700"
                                                )} />

                                                {/* Compact Row */}
                                                <div 
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-expanded={isExpanded}
                                                    aria-controls={`draft-content-${draft.id}`}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            toggleRow(draft.id);
                                                        }
                                                    }}
                                                    onClick={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (target.closest('button') || target.closest('a')) return;
                                                        toggleRow(draft.id);
                                                    }}
                                                    className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-5 cursor-pointer items-center min-h-[80px] focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-zinc-900"
                                                >
                                                    {/* Checkbox & Caret */}
                                                    <div className="lg:col-span-1 flex flex-row items-center justify-center gap-2">
                                                        <div className={cn(
                                                            "flex flex-col items-center transition-opacity duration-200 relative",
                                                            (!isSelected && !isExpanded) ? "lg:opacity-0 lg:group-hover:opacity-100" : "opacity-100"
                                                        )} onClick={e => e.stopPropagation()}>
                                                            {!isSelectable && (
                                                                <div 
                                                                    className="absolute inset-0 z-10 cursor-not-allowed" 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDisabledSelection(e);
                                                                    }}
                                                                />
                                                            )}
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={!isSelectable}
                                                                onChange={(e) => toggleSelection(e, draft.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                                                aria-label={`Select ${draft.title || 'draft'}`}
                                                            />
                                                        </div>
                                                        <div className={cn(
                                                            "h-6 w-6 rounded-full hidden lg:flex items-center justify-center transition-all bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0",
                                                            isExpanded ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400 rotate-180" : "text-slate-400 dark:text-zinc-500 group-hover:border-indigo-300 dark:group-hover:border-zinc-600"
                                                        )}>
                                                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </div>
                                                    </div>

                                                    {/* Source & Title */}
                                                    <div className="lg:col-span-3 rtl:pr-2 ltr:pl-2 flex flex-col justify-center">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            {isAudio ? (
                                                                <span className="bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 px-2 py-0.5 outline-none rounded text-[10px] font-bold tracking-widest uppercase flex items-center">
                                                                    <Mic className="w-3 h-3 rtl:ml-1 ltr:mr-1" aria-hidden="true" /> {t('dashboard.tagAudio')}
                                                                </span>
                                                            ) : (
                                                                <span className="bg-slate-100 text-slate-600 dark:bg-zinc-800/80 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700/50 px-2 py-0.5 outline-none rounded text-[10px] font-bold tracking-widest uppercase flex items-center">
                                                                    <FileText className="w-3 h-3 rtl:ml-1 ltr:mr-1" aria-hidden="true" /> {t('dashboard.tagText')}
                                                                </span>
                                                            )}
                                                            {(draft.tags || []).length > 0 && (
                                                                <span className="bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 outline-none rounded text-[10px] font-bold flex items-center shadow-sm">
                                                                    {draft.tags!.length} {t('common.tags') || 'Tags'}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center font-medium">
                                                                <Clock className="w-3 h-3 rtl:ml-1 ltr:mr-1 opacity-70" aria-hidden="true" />
                                                                {draft.createdAt?.toLocaleDateString ? draft.createdAt.toLocaleDateString() : ''}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-[14px] font-bold text-slate-900 dark:text-zinc-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {draft.title || draft.clientName || t('dashboard.clientUnassigned')}
                                                        </h4>
                                                    </div>

                                                    {/* Text Snippet / Content Preview */}
                                                    <div className="lg:col-span-4 hidden lg:block">
                                                        <p className="text-[13px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                                                            {stripMarkdown(draft.text || '...')}
                                                        </p>
                                                    </div>

                                                    {/* Status Badge */}
                                                    <div className="col-span-1 lg:col-span-2 flex items-center" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={draft.status}
                                                            onChange={(e) => handleInlineUpdate(draft.id, 'status', e.target.value, draft)}
                                                            className={cn(
                                                                "appearance-none px-3 py-1 text-[11px] font-bold rounded-full shadow-sm border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[90px] text-center",
                                                                draft.status === 'in_progress' ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700/50"
                                                            )}
                                                        >
                                                            <option value="pending" className="bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">{t('dashboard.statusPending')}</option>
                                                            <option value="in_progress" className="bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">{t('dashboard.statusInProgress')}</option>
                                                            <option value="approved" className="bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">{t('editor.statusApproved') || 'Approved'}</option>
                                                        </select>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="lg:col-span-2 flex items-center lg:justify-end gap-2 mt-4 lg:mt-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); router.push(`/drafts/${draft.id}`); }}
                                                            className="flex-1 lg:flex-none justify-center inline-flex items-center px-4 h-9 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:border-indigo-300 dark:hover:border-zinc-600 hover:text-indigo-600 dark:hover:text-zinc-100 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                            aria-label={`${t('dashboard.btnOpen')} ${draft.title || t('dashboard.clientUnassigned')}`}
                                                        >
                                                            <Edit3 className="h-4 w-4 rtl:ml-2 ltr:mr-2 opacity-70" aria-hidden="true" />
                                                            {t('dashboard.btnOpen')}
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(draft.id); }}
                                                                className="inline-flex items-center justify-center w-9 h-9 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:border-red-500/20 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                                title={t('dashboard.btnDelete')}
                                                                aria-label={t('dashboard.btnDelete')}
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Region */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            id={`draft-content-${draft.id}`}
                                                            key={`expand-${draft.id}`}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                                            className="overflow-hidden bg-slate-50 border-t border-slate-100 dark:bg-zinc-900/40 dark:border-t-zinc-800/60"
                                                        >
                                                            <div className="p-6 lg:rtl:pl-8 lg:rtl:pr-24 lg:ltr:pr-8 lg:ltr:pl-24 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                                
                                                                {/* Full Text View */}
                                                                <div>
                                                                    <div className="flex flex-col gap-3">
                                                                        <h5 className="text-[12px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 flex items-center gap-2 px-1">
                                                                            <FileText className="w-3.5 h-3.5" aria-hidden="true" /> {t('dashboard.expandedSourceTitle')}
                                                                        </h5>
                                                                        <div className="bg-white dark:bg-zinc-950/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 prose prose-sm dark:prose-invert max-w-none shadow-inner custom-scrollbar text-[13px] leading-relaxed text-slate-600 dark:text-zinc-300 max-h-[400px] overflow-y-auto">
                                                                            <div dangerouslySetInnerHTML={{ __html: parseMarkdown(draft.text || t('dashboard.noSourceText')) }} />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Metadata / Quick Info */}
                                                                <div className="space-y-4">
                                                                    <h5 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                                                                        <Database className="w-3.5 h-3.5" aria-hidden="true" /> {t('dashboard.expandedMetaTitle')}
                                                                    </h5>
                                                                    <div className="bg-white dark:bg-zinc-950/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 text-[13px] shadow-inner text-slate-600 dark:text-zinc-400 space-y-4">
                                                                        <div className="flex flex-col gap-1.5 z-20">
                                                                            <strong className="text-slate-800 dark:text-zinc-300 font-mono text-xs">Client:</strong>
                                                                            <ClientSelector 
                                                                                value={draft.clientName || ''}
                                                                                onChange={(newClient) => handleInlineUpdate(draft.id, 'clientName', newClient)}
                                                                                placeholder="Assign client..."
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 z-10 relative">
                                                                            <strong className="text-slate-800 dark:text-zinc-300 font-mono text-xs">Tags:</strong>
                                                                            <TagSelector 
                                                                                selectedIds={draft.tags || []} 
                                                                                onChange={(newTags) => handleInlineUpdate(draft.id, 'tags', newTags)} 
                                                                                placeholder="Add tags..." 
                                                                            />
                                                                        </div>
                                                                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-zinc-800/60 font-mono text-xs">
                                                                            <p><strong className="text-slate-800 dark:text-zinc-300">ID:</strong> {draft.id}</p>
                                                                            {isAudio && <p className="mt-1"><strong className="text-purple-600 dark:text-purple-400">Audio ID:</strong> {draft.audioFileId}</p>}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <button
                                                                        onClick={() => router.push(`/drafts/${draft.id}`)}
                                                                        className="w-full inline-flex justify-center items-center h-10 px-4 bg-slate-900 border border-transparent rounded-xl text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:focus:ring-indigo-500 dark:focus:ring-offset-zinc-950 transition-colors shadow-md"
                                                                        aria-label={t('dashboard.btnFullEditor')}
                                                                    >
                                                                        <Edit3 className="h-4 w-4 rtl:ml-2 ltr:mr-2" aria-hidden="true" /> {t('dashboard.btnFullEditor')}
                                                                    </button>
                                                                </div>
                                                                
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.li>
                                        );
                                    })}
                                </AnimatePresence>
                            </motion.ul>
                        </div>
                    )}
                </main>
                
                <AnimatePresence>
                    {toastMessage && toastPosition && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ 
                                position: 'fixed', 
                                ...toastPosition
                            }}
                            className="z-[150] px-3 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg shadow-2xl text-[12px] font-medium max-w-[280px] break-words text-start pointer-events-none"
                        >
                            {toastMessage}
                            <div 
                                className="absolute top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 dark:border-t-zinc-100" 
                                style={{
                                    ...(toastPosition.left ? { left: '20px' } : { right: '20px' })
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bulk Actions Bar */}
                <BulkActionBar 
                    selectedCount={selectedDraftIds.size}
                    baseClientName={baseClientName}
                    onClearSelection={() => setSelectedDraftIds(new Set())}
                    onDeleteSelected={handleBulkDelete}
                    onMergeSelected={handleBulkMerge}
                />

                {/* Merge Modal */}
                <MergeDraftsModal
                    isOpen={isMergeModalOpen}
                    onClose={() => setIsMergeModalOpen(false)}
                    drafts={drafts.filter(d => selectedDraftIds.has(d.id))}
                    onConfirm={executeMerge}
                />
            </div>
        </AuthGuard>
    );
}
