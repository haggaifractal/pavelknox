'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import AuthGuard from '@/components/ui/AuthGuard';
import { ArrowLeft, Save, CheckCircle, FileText, CheckCircle2, ChevronRight, Mic, ListTodo, AlertTriangle, ExternalLink } from 'lucide-react';
import TasksPanel from '@/components/tasks/TasksPanel';
import { Draft } from '@/lib/hooks/usePendingDrafts';
import { useAuth } from '@/lib/contexts/AuthContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import MergeDraftsModal from '@/components/ui/MergeDraftsModal';
import ClientSelector from '@/components/ui/ClientSelector';
import TagSelector from '@/components/ui/TagSelector';

interface EditorPageProps {
    params: Promise<{ id: string }>;
}

export default function DraftEditorPage({ params }: EditorPageProps) {
    const resolvedParams = use(params);
    const draftId = resolvedParams.id;
    const router = useRouter();
    const { user, isAdmin, loading: authLoading } = useAuth();
    const { t } = useTranslation();

    const [draft, setDraft] = useState<Draft | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [clientName, setClientName] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [status, setStatus] = useState<'pending'|'in_progress'|'approved'>('pending');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isTasksPanelOpen, setIsTasksPanelOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            router.push('/knowledge');
        }
    }, [authLoading, user, isAdmin, router]);

    useEffect(() => {
        async function loadDraft() {
            try {
                const docRef = doc(db, 'drafts', draftId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDraft({ id: docSnap.id, ...data } as Draft);
                    setContent(data.editedText || data.content || data.redactedText || data.summary || data.text || '');
                    setTitle(data.title || '');
                    setClientName(data.clientName || '');
                    setTags(data.tags || []);
                    setStatus(data.status || 'pending');
                } else {
                    setError(t('editor.errorNotFound'));
                }
            } catch (err) {
                console.error(err);
                setError(t('editor.errorLoading'));
            } finally {
                setLoading(false);
            }
        }
        if (!authLoading && isAdmin) {
            loadDraft();
        }
    }, [draftId, authLoading, isAdmin, t]);

    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!draft || loading || !isAdmin) return;

            const tagsChanged = JSON.stringify(tags) !== JSON.stringify((draft as any).tags || []);
            if (content !== (draft as any).editedText || title !== (draft as any).title || clientName !== (draft as any).clientName || status !== (draft as any).status || tagsChanged) {
                setSaving(true);
                try {
                    await updateDoc(doc(db, 'drafts', draftId), {
                        editedText: content,
                        title: title,
                        clientName: clientName,
                        tags: tags,
                        status: status,
                        lastSavedAt: new Date()
                    });
                    setDraft(prev => prev ? { ...prev, editedText: content, title: title, clientName: clientName, tags: tags, status: status } as any : prev);
                } catch (e) {
                    console.error("Auto-save failed", e);
                } finally {
                    setSaving(false);
                }
            }
        }, 1500);

        return () => clearTimeout(timeoutId);
    }, [content, title, clientName, tags, status, draft, draftId, loading, isAdmin]);

    const handlePublish = async () => {
        if (!title.trim() || !content.trim()) {
            alert(t('editor.alertEmpty'));
            return;
        }

        if (!isAdmin) {
            alert(t('editor.alertNoPerms'));
            return;
        }

        try {
            setSaving(true);
            const publishDate = new Date();

            await updateDoc(doc(db, 'drafts', draftId), {
                editedText: content,
                title: title,
                tags: tags,
                status: 'approved',
                publishedAt: publishDate
            });

            // Clean up previous knowledge doc & vectors if this draft was an "Edit" flow
            if (draft?.sourceKnowledgeId) {
                try {
                    console.log('Cleaning up old knowledge base item:', draft.sourceKnowledgeId);
                    await fetch('/api/knowledge/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: draft.sourceKnowledgeId })
                    });
                } catch(e) {
                    console.error('Failed to cleanup old knowledge', e);
                }
            }

            const kbDocRef = await addDoc(collection(db, 'knowledge_base'), {
                title: title,
                content: content,
                clientName: clientName,
                tags: tags,
                sourceDraftId: draftId,
                publishedAt: publishDate
            });

            // Auto-ingest into RAG Vector DB
            try {
                const token = await user?.getIdToken();
                const ingestRes = await fetch('/api/knowledge/ingest', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: title || 'Untitled Draft',
                        content: content,
                        clientName: clientName,
                        tags: tags,
                        type: 'approved_draft',
                        sourceUrl: `/knowledge/${kbDocRef.id}`
                    })
                });
                if (!ingestRes.ok) {
                    console.error('Vectorization API failed:', await ingestRes.text());
                }
            } catch (ingestErr) {
                console.error('Network error triggering vectorization:', ingestErr);
            }

            router.push('/');
        } catch (e) {
            console.error("Publish failed with error:", e);
            alert(t('editor.alertError').replace('{error}', (e as Error).message));
            setSaving(false);
        }
    };

    if (loading || authLoading || !isAdmin) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center transition-colors duration-300" aria-live="polite" aria-busy="true">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                </div>
            </AuthGuard>
        );
    }

    if (error || !draft) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-8 flex flex-col items-center justify-center transition-colors duration-300">
                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-red-900/30 p-8 rounded-2xl flex flex-col items-center max-w-sm w-full backdrop-blur-sm shadow-sm transition-colors" aria-live="assertive">
                        <div className="h-12 w-12 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-100 dark:border-transparent">
                            <FileText className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-6 text-center">{error}</h1>
                        <button 
                            onClick={() => router.push('/')} 
                            className="flex items-center text-sm px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                            <ArrowLeft className="w-4 h-4 rtl:ml-2 ltr:mr-2 ltr:rotate-180" aria-hidden="true" />
                            {t('editor.btnBackToKnowledge')}
                        </button>
                    </div>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col overflow-hidden text-slate-900 dark:text-zinc-300 selection:bg-indigo-500/30 transition-colors duration-300">
                
                {/* Header */}
                <header className="bg-white/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/60 sticky top-0 z-20 backdrop-blur-xl transition-colors">
                    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                        
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 -mr-2 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                aria-label={t('common.back')}
                            >
                                <ChevronRight className="w-5 h-5 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 ltr:rotate-180 transition-transform" aria-hidden="true" />
                            </button>
                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-zinc-800 hidden sm:block"></div>
                            <h1 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100 hidden sm:block flex-shrink-0 transition-colors">
                                {t('editor.title')}
                            </h1>
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:text-zinc-500 dark:bg-zinc-900/50 px-2 py-1 rounded hidden md:block border border-slate-200 dark:border-zinc-800/50 transition-colors">
                                {draftId.slice(0, 8)}...
                            </span>
                        </div>

                        <div className="flex items-center gap-4 xl:gap-6">
                            <button
                                onClick={() => setIsTasksPanelOpen(true)}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                title={t('tasks.panelTitle') || 'משימות'}
                            >
                                <ListTodo className="w-5 h-5" />
                                <span className="text-[13px] font-semibold hidden sm:inline-block">{t('tasks.panelTitle') || 'משימות'}</span>
                            </button>

                            <div className="h-5 w-[1px] bg-slate-200 dark:bg-zinc-800 hidden sm:block"></div>

                            <div className="text-[13px] flex items-center font-medium min-w-[80px] justify-end" aria-live="polite">
                                {saving ? (
                                    <span className="flex items-center text-indigo-600 dark:text-indigo-400">
                                        <Save className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5 animate-pulse" aria-hidden="true" /> {t('common.saving')}
                                    </span>
                                ) : (
                                    <span className="flex items-center text-emerald-600 dark:text-emerald-400/80">
                                        <CheckCircle className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5" aria-hidden="true" /> {t('common.saved')}
                                    </span>
                                )}
                            </div>
                            


                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handlePublish}
                                disabled={!title.trim() || !content.trim() || saving}
                                className="inline-flex items-center justify-center h-9 px-5 border border-transparent text-[13px] font-semibold rounded-lg shadow-sm shadow-indigo-500/10 text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-zinc-950 focus:ring-indigo-500"
                            >
                                <CheckCircle2 className="w-4 h-4 rtl:ml-2 ltr:mr-2 opacity-80" aria-hidden="true" />
                                {t('editor.btnPublish')}
                            </motion.button>
                        </div>
                    </div>
                </header>

                {/* Main Workspace */}
                <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden h-[calc(100vh-4rem)]">
                    
                    {/* Left Pane - Raw Telemetry / Context (4 cols on large screens) */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                        className="lg:col-span-4 xl:col-span-3 flex flex-col h-full overflow-hidden"
                    >
                        <h2 className="text-[11px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest rtl:pl-1 ltr:pr-1 mb-3 flex items-center gap-2 transition-colors">
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('editor.rawSourceTitle')}
                        </h2>
                        <div className="bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800/60 flex-1 flex flex-col overflow-hidden backdrop-blur-sm relative transition-colors shadow-sm">
                            {/* Decorative gradient */}
                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-slate-50 dark:from-zinc-800/20 to-transparent pointer-events-none transition-colors" />
                            
                            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar relative z-10">
                                {draft.audioFileId && (
                                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400 font-semibold text-sm transition-colors">
                                            <Mic className="w-4 h-4" aria-hidden="true" />
                                            {t('editor.voiceMessage')}
                                        </div>
                                        <div className="text-[11px] font-mono text-indigo-600 bg-indigo-100/50 dark:text-indigo-300/70 dark:bg-indigo-950/50 px-2 py-1 rounded inline-block mb-3 border border-indigo-200 dark:border-indigo-500/10 transition-colors">
                                            ID: {draft.audioFileId}
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed italic transition-colors">
                                            {t('editor.audioPlaceholder')}
                                        </p>
                                    </div>
                                )}

                                <div className="text-[13px] leading-relaxed text-slate-600 dark:text-zinc-400 whitespace-pre-wrap font-medium transition-colors">
                                    {draft.text || t('editor.noSourceAvailable')}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Pane - Rich Editor (8 cols on large screens) */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="lg:col-span-8 xl:col-span-9 flex flex-col h-full overflow-hidden"
                    >
                        <h2 className="text-[11px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest rtl:pl-1 ltr:pr-1 mb-3 transition-colors">
                            {t('editor.organizedKnowledgeTitle')}
                        </h2>
                        
                        {(draft as any)?.isDuplicate && (
                            <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl flex items-start gap-3 transition-colors">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">אזהרה: ייתכן וזו כפילות</h3>
                                    <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                                        הטקסט בטיוטה זו דומה מאוד למסמך שכבר קיים במאגר הידע.
                                    </p>
                                    {(draft as any)?.duplicateSourceUrl && (
                                        <a href={(draft as any).duplicateSourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 underline underline-offset-2">
                                            צפה במסמך התואם <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="bg-white dark:bg-[#0c0c0e] rounded-2xl border border-slate-200 dark:border-zinc-800/60 flex-1 flex flex-col overflow-hidden shadow-sm dark:shadow-2xl dark:shadow-black/50 focus-within:border-indigo-300 dark:focus-within:border-zinc-700/80 focus-within:ring-1 focus-within:ring-indigo-300/50 dark:focus-within:ring-zinc-700/50 transition-all group">
                            
                            {/* Editor Header / Meta fields */}
                            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/20 flex flex-col gap-5 transition-colors">
                                <label htmlFor="doc-title" className="sr-only">{t('editor.inputTitlePlaceholder')}</label>
                                <input
                                    id="doc-title"
                                    type="text"
                                    placeholder={t('editor.inputTitlePlaceholder')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 border-none focus:ring-0 px-0 bg-transparent transition-colors"
                                />

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="w-[200px] z-20">
                                        <ClientSelector 
                                            value={clientName} 
                                            onChange={setClientName} 
                                            placeholder={t('editor.clientPlaceholder')}
                                        />
                                    </div>

                                    <div className="relative">
                                        <label htmlFor="status-select" className="sr-only">סטטוס</label>
                                        <select 
                                            id="status-select"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as any)}
                                            className="appearance-none bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-[13px] rounded-lg rtl:pl-8 rtl:pr-4 ltr:pr-8 ltr:pl-4 py-2 hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm min-w-[160px] cursor-pointer"
                                        >
                                            <option value="pending">{t('editor.statusPending')}</option>
                                            <option value="in_progress">{t('editor.statusInProgress')}</option>
                                            <option value="approved">{t('editor.statusApproved')}</option>
                                        </select>
                                    </div>
                                    <div className="w-full sm:w-[300px] z-10">
                                        <TagSelector selectedIds={tags} onChange={setTags} placeholder="Select tags..." />
                                    </div>
                                </div>
                            </div>

                            {/* Main Textarea */}
                            <label htmlFor="doc-content" className="sr-only">{t('editor.textareaPlaceholder')}</label>
                            <textarea
                                id="doc-content"
                                className="w-full flex-1 resize-none p-5 sm:p-6 text-slate-700 dark:text-zinc-300 placeholder-slate-400 dark:placeholder-zinc-700 border-none focus:ring-0 bg-transparent leading-[1.8] text-[15px] custom-scrollbar selection:bg-indigo-500/30 transition-colors"
                                placeholder={t('editor.textareaPlaceholder')}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </div>
                    </motion.div>
                </main>

                <TasksPanel 
                    isOpen={isTasksPanelOpen} 
                    onClose={() => setIsTasksPanelOpen(false)} 
                    draftId={draftId as string} 
                    content={content} 
                    metadata={{ title, clientName, tags }} 
                />
            </div>
        </AuthGuard>
    );
}
