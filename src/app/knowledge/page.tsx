'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { LogOut, Database, Search, ChevronRight, FileCheck2, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/lib/contexts/LanguageContext';

export default function KnowledgeBasePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [allTags, setAllTags] = useState<Record<string, { id: string; label: string; colorHex: string }>>({});
    const { t } = useTranslation();

    useEffect(() => {
        const q = query(collection(db, 'tags'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsMap: Record<string, any> = {};
            snapshot.forEach(doc => { tagsMap[doc.id] = { id: doc.id, ...doc.data() }; });
            setAllTags(tagsMap);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'knowledge_base'), orderBy('publishedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: any[] = [];
            snapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });
            setDocuments(results);
            setLoading(false);
        }, (error) => {
            console.error("Failed to fetch knowledge base", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    const filteredDocs = documents.filter(doc => {
        const term = searchTerm.toLowerCase();
        const titleMatch = doc.title?.toLowerCase().includes(term);
        const contentMatch = doc.content?.toLowerCase().includes(term);
        const clientMatch = doc.clientName?.toLowerCase().includes(term);
        const tagMatch = doc.tags?.some((tagId: string) => allTags[tagId]?.label.toLowerCase().includes(term));
        return titleMatch || contentMatch || clientMatch || tagMatch;
    });

    const containerVariants: any = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-300 selection:bg-indigo-500/30 transition-colors duration-300">
                


                <main className="max-w-[1600px] mx-auto py-8 sm:py-12 px-4 sm:px-6">
                    
                    {/* Search Bar */}
                    <div className="mb-12 max-w-2xl mx-auto relative z-20">
                        <div className="relative group/search">
                            <label htmlFor="search-archive" className="sr-only">{t('knowledgeBase.searchPlaceholder')}</label>
                            <div className="absolute inset-y-0 rtl:right-0 rtl:pr-4 ltr:left-0 ltr:pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400 dark:text-zinc-500 group-focus-within/search:text-indigo-600 dark:group-focus-within/search:text-indigo-400 transition-colors" aria-hidden="true" />
                            </div>
                            <input
                                id="search-archive"
                                type="text"
                                className="block w-full rtl:pr-12 rtl:pl-4 ltr:pl-12 ltr:pr-4 py-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/80 rounded-2xl leading-5 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:bg-white dark:focus:bg-zinc-900 text-[15px] shadow-sm dark:shadow-lg dark:shadow-black/20 text-slate-900 dark:text-zinc-100 transition-all backdrop-blur-sm"
                                placeholder={t('knowledgeBase.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute inset-y-0 rtl:left-0 rtl:pl-4 ltr:right-0 ltr:pr-4 flex items-center" aria-live="polite">
                                    <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-500/20">
                                        {t('knowledgeBase.searchResults').replace('{count}', filteredDocs.length.toString())}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-48" aria-live="polite" aria-busy="true">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    ) : documents.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-zinc-900/30 border border-dashed border-slate-300 dark:border-zinc-800 max-w-lg mx-auto rounded-3xl p-12 text-center flex flex-col items-center justify-center backdrop-blur-sm shadow-sm"
                        >
                            <div className="h-16 w-16 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 dark:border-transparent">
                                <Database className="w-8 h-8 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-slate-800 dark:text-zinc-100 font-semibold mb-2">{t('knowledgeBase.emptyTitle')}</h3>
                            <p className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed max-w-[280px]">
                                {t('knowledgeBase.emptyDesc')}
                            </p>
                        </motion.div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="text-center py-16" aria-live="polite">
                            <p className="text-slate-500 dark:text-zinc-500">{t('knowledgeBase.noMatch')}</p>
                        </div>
                    ) : (
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        >
                            <AnimatePresence>
                                {filteredDocs.map((doc) => (
                                    <motion.div 
                                        key={doc.id}
                                        variants={itemVariants}
                                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                        onClick={() => router.push(`/knowledge/${doc.id}`)} 
                                        className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 shadow-sm rounded-2xl p-6 flex flex-col h-[280px] hover:border-slate-300 dark:hover:bg-zinc-900 dark:hover:border-zinc-700 hover:shadow-xl dark:hover:shadow-black/40 cursor-pointer transition-all backdrop-blur-sm group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                router.push(`/knowledge/${doc.id}`);
                                            }
                                        }}
                                        aria-label={`${doc.title || t('knowledgeBase.untitled')}`}
                                    >
                                        
                                        {/* Optional top accent border */}
                                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-slate-300 dark:via-zinc-700/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-500/20">
                                                <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                {t('knowledgeBase.tagApproved')}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                                                {doc.publishedAt?.toDate ? doc.publishedAt.toDate().toLocaleDateString() : ''}
                                            </div>
                                        </div>

                                        <h3 className="text-[17px] font-bold text-slate-900 dark:text-zinc-100 mb-3 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {doc.title || t('knowledgeBase.untitled')}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                            {doc.clientName && (
                                                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700/50">
                                                    {doc.clientName}
                                                </span>
                                            )}
                                            {(doc.tags || []).map((tagId: string) => {
                                                const tag = allTags[tagId];
                                                if (!tag) return null;
                                                return (
                                                    <span key={tagId} className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: `${tag.colorHex}20`, color: tag.colorHex, border: `1px solid ${tag.colorHex}40` }}>
                                                        {tag.label}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-auto relative">
                                            <p className="text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                                                {doc.content}
                                            </p>
                                            {/* Fade out text at the bottom */}
                                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 dark:from-zinc-900 dark:via-zinc-900/80 to-transparent opacity-90 group-hover:from-white dark:group-hover:from-zinc-900 transition-colors" />
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
