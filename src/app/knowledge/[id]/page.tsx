'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, onSnapshot, addDoc, getDocs, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ArrowLeft, Database, Calendar, FileCheck2, User, ChevronRight, Edit2, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { parseMarkdown } from '@/lib/utils';
import TaskTransferModal from '@/components/modals/TaskTransferModal';

interface KnowledgeViewProps {
    params: Promise<{ id: string }>;
}

export default function KnowledgeViewPage({ params }: KnowledgeViewProps) {
    const resolvedParams = use(params);
    const docId = resolvedParams.id;
    const router = useRouter();
    const { t } = useTranslation();
    const { user, isAdmin, permissions } = useAuth();

    const [document, setDocument] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [allTags, setAllTags] = useState<Record<string, { id: string; label: string; colorHex: string }>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [transferModal, setTransferModal] = useState<{
        isOpen: boolean;
        taskCount: number;
    }>({ isOpen: false, taskCount: 0 });

    const handleEdit = async () => {
        setIsEditing(true);
        try {
            const draftsRef = collection(db, 'drafts');
            const newDocRef = await addDoc(draftsRef, {
                title: document.title || '',
                content: document.content || '',
                clientName: document.clientName || '',
                tags: document.tags || [],
                visibilityScope: document.visibilityScope || 'global',
                departmentIds: document.departmentIds || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'pending',
                type: document.type || 'article',
                sourceKnowledgeId: document.id 
            });

            const tasksQuery = query(collection(db, 'tasks'), where('sourceId', '==', document.id));
            const tasksSnap = await getDocs(tasksQuery);
            if (!tasksSnap.empty) {
                const batchPromises = tasksSnap.docs.map(taskDoc => 
                    updateDoc(doc(db, 'tasks', taskDoc.id), {
                        sourceId: newDocRef.id,
                        sourceType: 'draft',
                        sourceUrl: `/drafts/${newDocRef.id}`,
                        updatedAt: new Date()
                    })
                );
                await Promise.all(batchPromises);
                console.log(`Moved ${tasksSnap.size} tasks to new draft`);
            }

            router.push(`/drafts/${newDocRef.id}`);
        } catch (e) {
            console.error(e);
            alert('Failed to launch editor');
            setIsEditing(false);
        }
    };

    const handleDelete = async () => {
        try {
            const tasksQuery = query(collection(db, 'tasks'), where('sourceId', '==', document.id));
            const tasksSnap = await getDocs(tasksQuery);
            
            if (!tasksSnap.empty) {
                const openTasks = tasksSnap.docs.filter(doc => {
                    const status = doc.data().status;
                    return status === 'pending' || status === 'in_progress' || !doc.data().isDeleted;
                });
                
                const activeLinkedTasks = openTasks.filter(doc => doc.data().isDeleted !== true);

                if (activeLinkedTasks.length > 0) {
                    setTransferModal({ isOpen: true, taskCount: activeLinkedTasks.length });
                    return; // Blocking deletion until transferred
                }
            }

            if (!confirm(t('knowledgeBase.confirmDelete') || 'האם אתה בטוח שברצונך למחוק מסמך זה? המחיקה תסיר גם את הלמידה של ה-AI.')) return;
            
            await performDelete(null);
        } catch (e) {
            console.error('Failed to pre-check deletion', e);
            alert('Failed to pre-check deletion');
        }
    };

    const performDelete = async (transferToClientName: string | null) => {
        setIsDeleting(true);
        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/knowledge/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: document.id, transferToClientName }),
            });
            if (res.ok) {
                router.push('/knowledge');
            } else {
                alert('Failed to delete document');
                setIsDeleting(false);
            }
        } catch (e) {
            console.error(e);
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'tags'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsMap: Record<string, any> = {};
            snapshot.forEach(d => { tagsMap[d.id] = { id: d.id, ...d.data() }; });
            setAllTags(tagsMap);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        async function loadDoc() {
            try {
                const docSnap = await getDoc(doc(db, 'knowledge_base', docId));
                if (docSnap.exists()) {
                    setDocument({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadDoc();
    }, [docId]);

    if (loading) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex justify-center items-center transition-colors duration-300" aria-live="polite" aria-busy="true">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 border-t-transparent"></div>
                </div>
            </AuthGuard>
        );
    }

    if (!document) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-8 flex flex-col items-center justify-center transition-colors" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/60 p-8 rounded-2xl flex flex-col items-center max-w-sm w-full backdrop-blur-sm shadow-sm" aria-live="assertive">
                        <div className="h-12 w-12 bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 rounded-full flex items-center justify-center mb-4">
                            <Database className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-6 text-center">{t('knowledgeBase.docNotFound')}</h1>
                        <button 
                            onClick={() => router.push('/knowledge')} 
                            className="flex items-center text-sm px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                            <ArrowLeft className="w-4 h-4 rtl:ml-2 ltr:mr-2 ltr:rotate-180" aria-hidden="true" />
                            {t('knowledgeBase.btnBack')}
                        </button>
                    </div>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans text-slate-900 dark:text-zinc-300 transition-colors duration-300 selection:bg-indigo-500/30">
                


                <main className="max-w-[1000px] mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
                    <motion.article 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="bg-white dark:bg-[#0c0c0e] rounded-3xl shadow-sm dark:shadow-2xl dark:shadow-black/50 border border-slate-200 dark:border-zinc-800/60 overflow-hidden transition-colors"
                    >
                        {/* Article Header */}
                        <div className="p-8 sm:p-12 border-b border-slate-100 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/20 relative overflow-hidden transition-colors">
                            {/* Decorative gradient dark mode */}
                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 opacity-50 pointer-events-none" />

                            <div className="flex flex-wrap items-center gap-4 text-[13px] font-medium text-slate-500 dark:text-zinc-400 mb-6 relative z-10">
                                <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    {t('knowledgeBase.tagApproved')}
                                </span>
                                <span className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2.5 py-1 rounded-full shadow-sm">
                                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                                    {document.publishedAt?.toDate ? document.publishedAt.toDate().toLocaleString('he-IL', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : t('knowledgeBase.unknownDate')}
                                </span>
                                {document.clientName && (
                                    <span className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2.5 py-1 rounded-full shadow-sm">
                                        <User className="w-3.5 h-3.5" aria-hidden="true" />
                                        {t('knowledgeBase.clientLabel')} {document.clientName}
                                    </span>
                                )}
                                {(document.tags || []).map((tagId: string) => {
                                    const tag = allTags[tagId];
                                    if (!tag) return null;
                                    return (
                                        <span key={tagId} className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm" style={{ backgroundColor: `${tag.colorHex}15`, color: tag.colorHex, border: `1px solid ${tag.colorHex}30` }}>
                                            {tag.label}
                                        </span>
                                    );
                                })}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 relative z-10 transition-colors">
                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight leading-tight flex-1">
                                    {document.title || t('knowledgeBase.untitled')}
                                </h1>
                                
                                {isAdmin && (
                                    <div className="flex items-center gap-3 shrink-0 mt-2 sm:mt-0">
                                        <button 
                                            onClick={handleEdit}
                                            disabled={isEditing || isDeleting}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-all font-medium text-sm shadow-sm hover:shadow disabled:opacity-50"
                                        >
                                            {isEditing ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Edit2 className="w-4 h-4 text-indigo-500" />}
                                            {t('knowledgeBase.btnEdit') || 'ערוך מידע'}
                                        </button>
                                        <button 
                                            onClick={handleDelete}
                                            disabled={isEditing || isDeleting}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 text-slate-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 rounded-xl transition-all font-medium text-sm shadow-sm hover:shadow disabled:opacity-50"
                                        >
                                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />}
                                            {t('knowledgeBase.btnDelete') || 'מחק מאגר'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Article Content */}
                        <div className="p-8 sm:p-12 relative z-10 bg-white dark:bg-transparent transition-colors">
                            <div className="prose prose-slate dark:prose-invert prose-lg max-w-none text-slate-700 dark:text-zinc-300 leading-relaxed transition-colors">
                                {document.content ? (
                                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(document.content) }} />
                                ) : (
                                    t('knowledgeBase.noContent')
                                )}
                            </div>
                        </div>
                    </motion.article>
                </main>
            </div>
            
            <TaskTransferModal
                isOpen={transferModal.isOpen}
                onClose={() => setTransferModal({ isOpen: false, taskCount: 0 })}
                onConfirmTransfer={async (newClientName) => {
                    await performDelete(newClientName);
                }}
                taskCount={transferModal.taskCount}
                entityType="knowledge"
            />
        </AuthGuard>
    );
}
