import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/client';
import { useAuth } from '../contexts/AuthContext';

export interface Client {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
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
                    contactPerson: data.contactPerson,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
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

    const addClient = async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client | null> => {
        if (!user || !clientData.name?.trim()) return null;
        try {
            const formattedName = clientData.name.trim();
            // Check if already exists by name
            const existing = clients.find(c => c.name.toLowerCase() === formattedName.toLowerCase());
            if (existing) return existing;

            const newClientData = {
                name: formattedName,
                contactPerson: clientData.contactPerson?.trim() || null,
                email: clientData.email?.trim() || null,
                phone: clientData.phone?.trim() || null,
                address: clientData.address?.trim() || null,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'clients'), newClientData);
            
            return {
                id: docRef.id,
                ...clientData,
                name: formattedName,
                createdAt: new Date()
            };
        } catch (err: any) {
            console.error("Error adding client:", err);
            throw err;
        }
    };

    const updateClient = async (id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> => {
        if (!user || !id) return;
        try {
            const clientRef = doc(db, 'clients', id);
            await updateDoc(clientRef, {
                ...updates
            });
        } catch (err: any) {
            console.error("Error updating client:", err);
            throw err;
        }
    };

    const deleteClient = async (id: string): Promise<void> => {
        if (!user || !id) return;
        try {
            await deleteDoc(doc(db, 'clients', id));
        } catch (err: any) {
            console.error("Error deleting client:", err);
            throw err;
        }
    };

    const importClients = async (importData: Omit<Client, 'id' | 'createdAt'>[]): Promise<number> => {
        if (!user || !importData.length) return 0;
        try {
            let addCount = 0;
            const batchSize = 400; // Firestore batch limit is 500, play it safe
            
            for (let i = 0; i < importData.length; i += batchSize) {
                const batchChunk = importData.slice(i, i + batchSize);
                const batch = writeBatch(db);
                
                batchChunk.forEach(client => {
                    if (client.name && client.name.trim()) {
                        const newRef = doc(collection(db, 'clients'));
                        batch.set(newRef, {
                            name: client.name.trim(),
                            contactPerson: client.contactPerson?.trim() || null,
                            email: client.email?.trim() || null,
                            phone: client.phone?.trim() || null,
                            address: client.address?.trim() || null,
                            createdAt: serverTimestamp()
                        });
                        addCount++;
                    }
                });
                
                if (addCount > 0) {
                    await batch.commit();
                }
            }
            return addCount;
        } catch (err: any) {
            console.error("Error importing clients:", err);
            throw err;
        }
    };

    return { clients, loading, error, addClient, updateClient, deleteClient, importClients };
}
