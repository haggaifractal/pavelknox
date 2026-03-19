'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { LogOut, Database, Search, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function KnowledgeBasePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch approved knowledge documents
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
        return titleMatch || contentMatch;
    });

    return (
        <AuthGuard>
            <div className="min-h-screen bg-slate-50">
                <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={() => router.push('/')}
                                    className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="flex-shrink-0 flex items-center space-x-2">
                                    <div className="h-8 w-8 bg-indigo-600 rounded flex items-center justify-center shadow-inner">
                                        <Database className="text-white w-4 h-4" />
                                    </div>
                                    <span className="text-xl font-bold tracking-tight text-slate-900">Knowledge Archive</span>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <span className="text-sm font-medium text-slate-500 hidden sm:inline-block">
                                    {user?.email}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="inline-flex items-center px-3 py-2 border border-slate-200 text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    <LogOut className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Logout</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>

                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

                    <div className="mb-10 max-w-2xl mx-auto">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-11 pr-4 py-4 border border-slate-200 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base shadow-sm font-medium text-slate-800 transition-all"
                                placeholder="Search across all approved knowledge..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                            <Database className="mx-auto h-12 w-12 text-slate-300" />
                            <h3 className="mt-4 text-sm font-bold text-slate-900 uppercase tracking-widest">No documents found</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                {searchTerm ? 'Try adjusting your search query.' : 'Publish some drafts from the Inbox first!'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredDocs.map(doc => (
                                <div key={doc.id} onClick={() => router.push(`/knowledge/${doc.id}`)} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 cursor-pointer transition-all flex flex-col overflow-hidden group p-6">
                                    <div className="flex items-center justify-between mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                                        <span>{doc.publishedAt?.toDate ? doc.publishedAt.toDate().toLocaleDateString() : 'Unknown Date'}</span>
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Approved</span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 mb-3 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                                        {doc.title}
                                    </h3>

                                    <p className="prose prose-sm text-slate-600 leading-relaxed line-clamp-4 flex-1">
                                        {doc.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
