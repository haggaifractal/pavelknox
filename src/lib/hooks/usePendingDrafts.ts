import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase/client';
import { useAuth } from '../contexts/AuthContext';

export interface Draft {
    id: string;
    text: string | null;
    title?: string;
    summary?: string;
    category?: string;
    clientName?: string;
    tags?: string[];
    sourceKnowledgeId?: string;
    isUrgent?: boolean;
    audioFileId: string | null;
    status: 'received' | 'pending' | 'approved' | 'rejected' | 'in_progress';
    createdAt: Date;
    chatId?: number;
    messageId?: number;
}

export interface DraftFilter {
    status?: string;
    tagId?: string;
}

export function usePendingDrafts(filter: DraftFilter = { status: 'pending' }, pageSize: number = 20) {
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [currentLimit, setCurrentLimit] = useState(pageSize);
    const { user } = useAuth();

    // Reset pagination limit when filters change
    useEffect(() => {
        setCurrentLimit(pageSize);
    }, [filter.status, filter.tagId, pageSize]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        setError(null);

        const constraints: QueryConstraint[] = [];
        
        if (filter.status && filter.status !== 'all') {
            constraints.push(where('status', '==', filter.status));
        }
        if (filter.tagId) {
            constraints.push(where('tags', 'array-contains', filter.tagId));
        }

        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(currentLimit));

        const q = query(collection(db, 'drafts'), ...constraints);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Draft[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    title: data.title || '',
                    summary: data.summary || '',
                    category: data.category || '',
                    clientName: data.clientName || '',
                    tags: data.tags || [],
                    text: data.content || data.summary || data.redactedText || data.text || '',
                    audioFileId: data.audioFileId || null,
                    status: data.status || 'pending',
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                    chatId: data.chatId,
                    messageId: data.messageId,
                });
            });

            setDrafts(results);
            setHasMore(snapshot.docs.length === currentLimit);
            setLoading(false);
            setLoadingMore(false);
        }, (err) => {
            console.error("Error subscribing to drafts:", err);
            setError(err as Error);
            setLoading(false);
            setLoadingMore(false);
        });

        return () => unsubscribe();
    }, [user, filter.status, filter.tagId, currentLimit]);

    const loadMore = () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        setCurrentLimit(prev => prev + pageSize);
    };

    // Keep refresh for compatibility but it's redundant with realtime listeners
    const refresh = () => {
        // Just setting the limit again will trigger a hard reload if we wanted, 
        // but it's already realtime, so we just do a dummy state flip or nothing.
        setCurrentLimit(pageSize); 
    };

    return { drafts, loading, loadingMore, hasMore, error, loadMore, refresh };
}
