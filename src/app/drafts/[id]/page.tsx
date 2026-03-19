'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import AuthGuard from '@/components/ui/AuthGuard';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { Draft } from '@/lib/hooks/usePendingDrafts';
import { useAuth } from '@/lib/contexts/AuthContext';

interface EditorPageProps {
    params: Promise<{ id: string }>;
}

export default function DraftEditorPage({ params }: EditorPageProps) { // Changed type annotation to EditorPageProps to maintain syntactic correctness
    const resolvedParams = use(params);
    const draftId = resolvedParams.id;
    const router = useRouter();
    const { user, isAdmin, loading: authLoading } = useAuth(); // Added useAuth hook

    const [draft, setDraft] = useState<Draft | null>(null); // Kept original type for Draft
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Admin check
    useEffect(() => {
        if (!authLoading && user && !isAdmin) {
            router.push('/knowledge');
        }
    }, [authLoading, user, isAdmin, router]);

    // 1. Fetch the Draft
    useEffect(() => {
        async function loadDraft() {
            try {
                const docRef = doc(db, 'raw_inputs', draftId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDraft({ id: docSnap.id, ...data } as Draft);
                    setContent(data.editedText || data.text || '');
                    setTitle(data.title || '');
                } else {
                    setError('Draft not found');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load draft');
            } finally {
                setLoading(false);
            }
        }
        // Only load draft if not redirecting due to auth and if user is admin
        if (!authLoading && isAdmin) {
            loadDraft();
        }
    }, [draftId, authLoading, isAdmin]); // Added authLoading and isAdmin to dependencies

    // 2. Debounced Auto-Save
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (!draft || loading || !isAdmin) return; // Added isAdmin check

            // We only save if there are actual new edits written locally
            if (content !== (draft as any).editedText || title !== (draft as any).title) {
                setSaving(true);
                try {
                    await updateDoc(doc(db, 'raw_inputs', draftId), {
                        editedText: content,
                        title: title,
                        lastSavedAt: new Date()
                    });

                    // Update local draft memory so we don't spam saves
                    setDraft(prev => prev ? { ...prev, editedText: content, title: title } as any : prev);
                } catch (e) {
                    console.error("Auto-save failed", e);
                } finally {
                    setSaving(false);
                }
            }
        }, 1500); // 1.5 seconds after user stops typing

        return () => clearTimeout(timeoutId);
    }, [content, title, draft, draftId, loading, isAdmin]); // Added isAdmin to dependencies

    // 3. Final Publish
    const handlePublish = async () => {
        console.log("🔵 Publish button clicked!");
        console.log("Current state -> title:", title, "content length:", content.length, "draftId:", draftId);

        if (!title.trim() || !content.trim()) {
            console.warn("🟡 Missing title or content");
            alert("Please provide a title and content before publishing.");
            return;
        }

        if (!isAdmin) { // Added isAdmin check for publishing
            alert("You do not have permission to publish.");
            return;
        }

        try {
            setSaving(true);
            console.log("🔵 Starting Firestore updates...");
            const publishDate = new Date();

            // Update original draft as approved
            console.log("🔵 Updating raw_inputs document...");
            await updateDoc(doc(db, 'raw_inputs', draftId), {
                editedText: content,
                title: title,
                status: 'approved',
                publishedAt: publishDate
            });
            console.log("🟢 raw_inputs updated successfully!");

            // Save a clean copy to the semantic knowledge base
            console.log("🔵 Adding document to knowledge_base...");
            await addDoc(collection(db, 'knowledge_base'), {
                title: title,
                content: content,
                sourceDraftId: draftId,
                publishedAt: publishDate
            });
            console.log("🟢 knowledge_base updated successfully! Redirecting...");

            router.push('/');
        } catch (e) {
            console.error("🔴 Publish failed with error:", e);
            alert(`Failed to publish. Error: ${(e as Error).message}`);
            setSaving(false);
        }
    };

    if (loading || authLoading || !isAdmin) { // Modified loading condition
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                </div>
            </AuthGuard>
        );
    }

    if (error || !draft) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">{error}</h1>
                    <button onClick={() => router.push('/')} className="text-slate-600 underline hover:text-slate-900">Back to Inbox</button>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 -ml-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-lg font-bold text-slate-900 hidden sm:block">Draft Editor</h1>
                        </div>

                        <div className="flex items-center space-x-4">
                            <span className="text-sm flex items-center text-slate-500 font-medium tracking-wide w-24 justify-end">
                                {saving ? (
                                    <span className="flex items-center text-amber-600">
                                        <Save className="w-4 h-4 mr-1.5 animate-bounce" /> Auto-saving...
                                    </span>
                                ) : (
                                    <span className="flex items-center text-emerald-600">
                                        <CheckCircle className="w-4 h-4 mr-1.5" /> Saved
                                    </span>
                                )}
                            </span>
                            <button
                                onClick={handlePublish}
                                disabled={!title.trim() || !content.trim()}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-slate-900 hover:bg-slate-800 xl:px-6 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
                            >
                                Publish Ready
                            </button>
                        </div>
                    </div>
                </header>

                {/* Editor Workspace */}
                <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 overflow-hidden h-[calc(100vh-4rem)]">

                    {/* Left Pane - Raw Context */}
                    <div className="flex flex-col space-y-3 h-full overflow-hidden">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Raw Context (Source)</h2>
                        <div className="bg-slate-100 rounded-xl p-5 border border-slate-200 flex-1 overflow-y-auto shadow-inner">
                            {draft.audioFileId && (
                                <div className="mb-5 p-4 bg-purple-100/50 text-purple-800 rounded-lg text-sm border border-purple-200 shadow-sm">
                                    <span className="font-bold flex items-center mb-1">
                                        🎤 Voice Message Context
                                    </span>
                                    Telegram File ID: <code className="bg-purple-200/50 px-1 py-0.5 rounded">{draft.audioFileId}</code>
                                    <p className="text-xs mt-2 opacity-70 italic">(Actual Audio Player will be injected here during Story 1.3 integration)</p>
                                </div>
                            )}

                            <div className="prose prose-sm prose-slate max-w-none">
                                <p className="whitespace-pre-wrap leading-relaxed text-slate-700 font-medium">
                                    {draft.text || "No text available."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Pane - Rich Editor */}
                    <div className="flex flex-col space-y-3 h-full overflow-hidden">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Structured Knowledge</h2>
                        <div className="bg-white rounded-xl shadow-md border border-slate-200 flex-1 flex flex-col overflow-hidden focus-within:ring-1 focus-within:ring-slate-300 transition-shadow">

                            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                                <input
                                    type="text"
                                    placeholder="Give this draft a clear Title..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 placeholder-slate-300 border-none focus:ring-0 px-0 bg-transparent"
                                />
                            </div>

                            <textarea
                                className="w-full flex-1 resize-none p-4 sm:p-5 text-slate-800 placeholder-slate-300 border-none focus:ring-0 bg-transparent leading-relaxed text-base"
                                placeholder="Start writing or organizing the actual knowledge here... Markdown is supported."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />

                        </div>
                    </div>

                </main>
            </div>
        </AuthGuard>
    );
}
