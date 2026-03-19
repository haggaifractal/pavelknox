'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ArrowLeft, Database, Calendar } from 'lucide-react';

interface KnowledgeViewProps {
    params: Promise<{ id: string }>;
}

export default function KnowledgeViewPage({ params }: KnowledgeViewProps) {
    const resolvedParams = use(params);
    const docId = resolvedParams.id;
    const router = useRouter();

    const [document, setDocument] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
                <div className="min-h-screen bg-slate-50 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </AuthGuard>
        );
    }

    if (!document) {
        return (
            <AuthGuard>
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                    <Database className="w-12 h-12 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Document not found</h2>
                    <button onClick={() => router.push('/knowledge')} className="text-indigo-600 hover:text-indigo-800 font-medium">
                        &larr; Back to Archive
                    </button>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50 font-sans">
                <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="mr-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium">
                            <Database className="w-4 h-4" />
                            <span>Knowledge Archive</span>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                    <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-8 sm:p-10 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center text-sm text-slate-500 mb-4">
                                <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider mr-4">
                                    Approved Knowledge
                                </span>
                                <span className="flex items-center">
                                    <Calendar className="w-4 h-4 mr-1.5" />
                                    {document.publishedAt?.toDate ? document.publishedAt.toDate().toLocaleDateString() : 'Unknown Date'}
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                {document.title}
                            </h1>
                        </div>

                        <div className="p-8 sm:p-10">
                            <div className="prose prose-slate prose-lg max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {document.content}
                            </div>
                        </div>
                    </article>
                </main>
            </div>
        </AuthGuard>
    );
}
