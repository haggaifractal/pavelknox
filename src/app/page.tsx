'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { LogOut, Inbox, Mic, FileText, ArrowRight } from 'lucide-react';
import { usePendingDrafts } from '@/lib/hooks/usePendingDrafts';
import { useState, useEffect } from 'react';

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

export default function DashboardPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { drafts, loading } = usePendingDrafts();
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    // If auth is loaded, and a user is logged in, but they are NOT the admin -> boot them to knowledge base
    if (!authLoading && user && !isAdmin) {
      router.push('/knowledge');
    }
  }, [authLoading, user, isAdmin, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const seedDummyData = async () => {
    setIsSeeding(true);
    const dummyDrafts = [
      {
        status: 'pending',
        text: 'פגישת צוות הבוקר: חגי הציע שנשנה את הארכיטקטורה כדי לעבוד עם Web Workers. למנוע מ-UI להיתקע. חייב לבדוק.',
        audioFileId: null,
        createdAt: new Date(),
        chatId: 123456,
        messageId: 101,
      },
      {
        status: 'pending',
        text: 'רעיון למיזם חדש: מערכת שתעשה אוטומציה של הודעות טלגרם למאגר ידע. קראתי לזה PavelKnox.',
        audioFileId: 'AwQD123145124124',
        createdAt: new Date(),
        chatId: 123456,
        messageId: 102,
      },
      {
        status: 'pending',
        text: 'להזדכות על ההוצאות של שרתי גוגל מהפרויקט האחרון. יש מסמך מרואי חשבון.',
        audioFileId: null,
        createdAt: new Date(),
        chatId: 123456,
        messageId: 103,
      }
    ];

    for (const draft of dummyDrafts) {
      await addDoc(collection(db, 'raw_inputs'), draft);
    }
    setIsSeeding(false);
  };

  if (!authLoading && !isAdmin) {
    return null; // Will be redirected by useEffect
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center space-x-2">
                  <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-lg">P</span>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-slate-900">PavelKnox</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-slate-500 hidden sm:inline-block">
                  {user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-slate-200 text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-colors shadow-sm"
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
                <Inbox className="w-6 h-6 mr-2 text-slate-700" />
                Inbox
              </h1>
              <button
                onClick={() => router.push('/knowledge')}
                className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
              >
                View Knowledge Archive &rarr;
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={seedDummyData}
                disabled={isSeeding}
                className="hidden sm:inline-flex text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md font-bold hover:bg-indigo-200 transition-colors disabled:opacity-50"
              >
                {isSeeding ? 'Seeding...' : '+ Generate Dummy Data'}
              </button>
              <span className="bg-slate-200 text-slate-700 py-1.5 px-3 rounded-full text-xs font-bold uppercase tracking-wider">
                {drafts.length} Pending
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl h-96 flex flex-col items-center justify-center text-slate-400">
              <Inbox className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-lg font-medium text-slate-600">You're all caught up!</p>
              <p className="text-sm mt-1 mb-6 text-slate-500">No pending knowledge drafts to review.</p>

              <button
                onClick={seedDummyData}
                disabled={isSeeding}
                className="sm:hidden text-sm bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md font-bold hover:bg-indigo-200 transition-colors disabled:opacity-50"
              >
                {isSeeding ? 'Seeding...' : 'Add Dummy Data (Dev Test)'}
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <div key={draft.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden group">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        {draft.audioFileId ? (
                          <span className="bg-purple-100 text-purple-700 p-1.5 rounded-md"><Mic className="h-4 w-4" /></span>
                        ) : (
                          <span className="bg-blue-100 text-blue-700 p-1.5 rounded-md"><FileText className="h-4 w-4" /></span>
                        )}
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          {draft.audioFileId ? 'Voice Note' : 'Text Note'}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {timeAgo(draft.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-800 text-sm line-clamp-4 leading-relaxed font-medium">
                      {draft.text ? draft.text : 'Audio processing pending...'}
                    </p>
                  </div>

                  <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between items-center group-hover:bg-slate-100 transition-colors">
                    <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">Needs Review</span>
                    <button
                      onClick={() => router.push(`/drafts/${draft.id}`)}
                      className="inline-flex items-center text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                    >
                      Open Editor
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
