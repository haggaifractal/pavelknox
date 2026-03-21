'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Tags, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Tag } from '@/components/ui/TagSelector';

export default function TagsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'tags'), orderBy('label'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsData: Tag[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
            setTags(tagsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching tags:', error);
            setErrorMsg('Failed to load tags.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (tagId: string, tagLabel: string) => {
        if (!confirm(`Are you sure you want to delete the tag "${tagLabel}"?\n\nThis will remove the tag from all associated drafts and knowledge documents.`)) {
            return;
        }

        setDeletingId(tagId);
        setErrorMsg('');

        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/tags/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: tagId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete tag');
            }
            // Realtime listener will remove it from UI
        } catch (error: any) {
            console.error('Error deleting tag:', error);
            setErrorMsg(error.message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AuthGuard requireAdmin>
            <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                            <Tags className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                                {t('common.navTags') || 'Tags'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                                Manage global tags used across the system
                            </p>
                        </div>
                    </div>
                </div>

                {errorMsg && (
                    <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{errorMsg}</p>
                    </div>
                )}

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : tags.length === 0 ? (
                        <div className="text-center py-20">
                            <Tags className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-100">No tags found</h3>
                            <p className="text-slate-500 dark:text-zinc-400 mt-1">Tags are created automatically when typing in a tag selector.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                            {tags.map(tag => (
                                <div key={tag.id} className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10" 
                                            style={{ backgroundColor: tag.colorHex || '#3b82f6' }}
                                        />
                                        <span className="font-medium text-slate-900 dark:text-zinc-100">{tag.label}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => handleDelete(tag.id, tag.label)}
                                            disabled={deletingId === tag.id}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
                                            title="Delete tag"
                                        >
                                            {deletingId === tag.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
