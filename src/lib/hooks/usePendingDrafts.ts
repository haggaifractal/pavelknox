import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/client';
import { useAuth } from '../contexts/AuthContext';

export interface Draft {
    id: string;
    text: string | null;
    title?: string;
    summary?: string;
    category?: string;
    isUrgent?: boolean;
    audioFileId: string | null;
    status: 'received' | 'pending' | 'approved' | 'rejected';
    createdAt: Date;
    chatId?: number;
    messageId?: number;
}

export function usePendingDrafts() {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth(); // We need to know if the user is verified

    useEffect(() => {
        // RACE CONDITION FIX: Do not listen to DB until Firebase Auth determines we are logged in!
        if (!user) return;

        const q = query(
            collection(db, 'drafts'),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Draft[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    title: data.title || '',
                    summary: data.summary || '',
                    category: data.category || '',
                    text: data.content || data.summary || data.redactedText || data.text || '',
                    audioFileId: data.audioFileId || null,
                    status: data.status,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    chatId: data.chatId,
                    messageId: data.messageId,
                });
            });

            results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            setDrafts(results);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching drafts:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]); // re-run this only when the user object initializes

    return { drafts, loading };
}
