'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { auth, db } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
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

function DraftCard({ draft, isNew, timeAgoFn }: { draft: any, isNew: boolean, timeAgoFn: (d: Date) => string }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(draft.title || '');
  const [content, setContent] = useState(draft.text || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
     setTitle(draft.title || '');
     setContent(draft.text || '');
  }, [draft]);

  const handlePublish = async () => {
    try {
      setSaving(true);
      const publishDate = new Date();
      await updateDoc(doc(db, 'drafts', draft.id), {
        title,
        editedText: content,
        status: 'approved',
        publishedAt: publishDate
      });
      await addDoc(collection(db, 'knowledge_base'), {
        title,
        content,
        sourceDraftId: draft.id,
        publishedAt: publishDate
      });
    } catch(e) {
      console.error(e);
      alert('Error publishing');
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  };

  const isUrgent = draft.isUrgent;

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden group ${isUrgent ? 'border-red-500' : 'border-slate-200'} relative h-full max-h-[500px]`}>
      {isUrgent && (
         <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider z-10 shadow-sm">
           דחוף קריטי
         </div>
      )}
      {!isUrgent && isNew && (
         <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider z-10 shadow-sm">
           התקבל עכשיו
         </div>
      )}

      <div className={`p-5 flex-1 flex flex-col overflow-y-auto ${isUrgent || isNew ? 'pt-7' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            {draft.audioFileId ? (
              <span className="bg-purple-100 text-purple-700 p-1.5 rounded-md"><Mic className="h-4 w-4" /></span>
            ) : (
              <span className="bg-blue-100 text-blue-700 p-1.5 rounded-md"><FileText className="h-4 w-4" /></span>
            )}
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {draft.category || (draft.audioFileId ? 'Voice Note' : 'Text Note')}
            </span>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {timeAgoFn(draft.createdAt)}
          </span>
        </div>

        {isEditing ? (
           <div className="flex flex-col space-y-3 flex-1">
             <input value={title} onChange={e => setTitle(e.target.value)} className="w-full font-bold border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm rounded bg-blue-50/50" placeholder="כותרת המסמך..." />
             <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full flex-1 border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 text-sm rounded min-h-[140px] resize-none bg-blue-50/50 leading-relaxed" placeholder="תוכן מקצועי..." />
           </div>
        ) : (
           <div className="text-slate-800 text-sm flex flex-col gap-2">
             {draft.title && <span className="font-bold text-base leading-tight">{draft.title}</span>}
             <span className="leading-relaxed font-medium whitespace-pre-wrap">{draft.text ? draft.text : 'Audio processing pending...'}</span>
           </div>
        )}
      </div>

      <div className="bg-slate-50 border-t border-slate-100 p-4 flex flex-col gap-3 group-hover:bg-slate-100 transition-colors">
        <div className="flex justify-between items-center w-full">
           <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded hidden xl:inline-block">ממתין לאישור</span>
           
           <div className="flex items-center space-x-2 space-x-reverse mx-auto xl:mx-0">
             <button onClick={() => setIsEditing(!isEditing)} className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 px-3 py-1.5 rounded bg-white shadow-sm transition-colors cursor-pointer">
               {isEditing ? 'ביטול עריכה' : '📄 עריכה מהירה'}
             </button>
             <button onClick={() => router.push(`/drafts/${draft.id}`)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded bg-blue-50 shadow-sm transition-colors cursor-pointer">
               למסך המלא
             </button>
           </div>
        </div>

        <button 
           onClick={handlePublish}
           disabled={saving || (!title.trim() && !content.trim())}
           className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-md shadow-sm text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
        >
           {saving ? 'מפרסם...' : (isEditing ? '✓ שמור שינויים ופרסם לארכיון' : '✓ פרסם לארכיון ישירות (Approve)')}
        </button>
      </div>
    </div>
  );
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

  if (!authLoading && user && !isAdmin) {
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
                  <LogOut className="h-4 w-4 sm:me-2" />
                  <span className="hidden sm:inline">התנתק</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
                <Inbox className="w-6 h-6 me-2 text-slate-700" />
                תיבת ידע
              </h1>
              <button
                onClick={() => router.push('/knowledge')}
                className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
              >
                ארכיון הידע &larr;
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={seedDummyData}
                disabled={isSeeding}
                className="hidden sm:inline-flex text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md font-bold hover:bg-indigo-200 transition-colors disabled:opacity-50"
              >
                {isSeeding ? 'Seeding...' : '+ יצור דאטה דמו'}
              </button>
              <span className="bg-slate-200 text-slate-700 py-1.5 px-3 rounded-full text-xs font-bold uppercase tracking-wider">
                {drafts.length} ממתינים
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
              {drafts.map((draft, index) => (
                <DraftCard key={draft.id} draft={draft} isNew={index === 0} timeAgoFn={timeAgo} />
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
