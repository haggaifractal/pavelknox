import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/client';
import { useAuth } from '../contexts/AuthContext';

export interface Client {
    id: string;
    name: string;
    createdAt?: Date;
}

export function useClients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'clients'),
            orderBy('name', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results: Client[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                results.push({
                    id: doc.id,
                    name: data.name,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined,
                });
            });

            // Fallback sort in memory to ensure completely case-insensitive alphabetical sorting
            results.sort((a, b) => a.name.localeCompare(b.name, 'he'));
            
            setClients(results);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching clients:", err);
            setError(err as Error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const addClient = async (name: string): Promise<Client | null> => {
        if (!user || !name.trim()) return null;
        try {
            const formattedName = name.trim();
            // Check if already exists (basic client side check to prevent obvious duplicates)
            const existing = clients.find(c => c.name.toLowerCase() === formattedName.toLowerCase());
            if (existing) return existing;

            const docRef = await addDoc(collection(db, 'clients'), {
                name: formattedName,
                createdAt: serverTimestamp()
            });
            
            return {
                id: docRef.id,
                name: formattedName,
                createdAt: new Date()
            };
        } catch (err: any) {
            console.error("Error adding client:", err);
            throw err;
        }
    };

    return { clients, loading, error, addClient };
}
