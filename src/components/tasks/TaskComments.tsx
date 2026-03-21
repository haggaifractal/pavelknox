import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Send, User as UserIcon, Trash2, Loader2 } from 'lucide-react';

const formatDate = (date: any) => {
    if (!date) return 'עכשיו';
    return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: 'numeric'
    }).format(date);
};

interface Comment {
    id: string;
    text: string;
    authorName: string;
    authorId?: string;
    authorEmail?: string;
    createdAt: any;
    isSystemEvent?: boolean;
}

interface TaskCommentsProps {
    taskId: string;
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
    const { user, isAdmin } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

    useEffect(() => {
        if (!taskId) return;

        const commentsRef = collection(db, 'tasks', taskId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];
            setComments(fetchedComments);
        });

        return () => unsubscribe();
    }, [taskId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, 'tasks', taskId, 'comments');
            await addDoc(commentsRef, {
                text: newComment.trim(),
                authorName: user.displayName || user.email?.split('@')[0] || 'משתמש',
                authorEmail: user.email,
                authorId: user.uid,
                createdAt: serverTimestamp(),
                isSystemEvent: false
            });
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            // Optionally add toast here
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק הערה זו? פעולה זו תישמר ביומן המערכת.')) return;
        
        setDeletingCommentId(commentId);
        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/tasks/comments/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ taskId, commentId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            alert('שגיאה במחיקת ההערה');
        } finally {
            setDeletingCommentId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950/50 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
                {comments.length === 0 ? (
                    <div className="text-center text-slate-500 dark:text-zinc-500 text-sm py-4">
                        אין עדיין הערות או פעילות
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className={`flex gap-3 ${comment.isSystemEvent ? 'justify-center' : ''}`}>
                            {!comment.isSystemEvent && (
                                <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <UserIcon className="w-4 h-4" />
                                </div>
                            )}
                            <div className={`flex flex-col ${comment.isSystemEvent ? 'items-center text-center' : 'items-start'}`}>
                                {!comment.isSystemEvent && (
                                    <div className="flex items-center gap-2 mb-1 w-full justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                                                {comment.authorName}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                                {comment.createdAt?.toDate() ? formatDate(comment.createdAt.toDate()) : 'עכשיו'}
                                            </span>
                                        </div>
                                        {(isAdmin || (user && comment.authorId === user.uid)) && (
                                            <button
                                                onClick={() => handleDelete(comment.id)}
                                                disabled={deletingCommentId === comment.id}
                                                className="text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors mr-2"
                                                title="מחק הערה"
                                            >
                                                {deletingCommentId === comment.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3 h-3" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className={`text-sm ${
                                    comment.isSystemEvent 
                                        ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-xs px-3 py-1 rounded-full' 
                                        : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 px-4 py-2 rounded-2xl rounded-tr-none'
                                }`}>
                                    {comment.text}
                                </div>
                                {comment.isSystemEvent && (
                                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                                        {comment.createdAt?.toDate() ? formatDate(comment.createdAt.toDate()) : 'עכשיו'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comment Input */}
            <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="הוסף הערה..."
                        disabled={isSubmitting}
                        className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        dir="rtl"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isSubmitting}
                        className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 disabled:opacity-50 flex items-center justify-center transition-colors"
                    >
                        <Send className="w-4 h-4 rtl:-scale-x-100" />
                    </button>
                </form>
            </div>
        </div>
    );
}
