'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            const adminEmails = ['chagai33@gmail.com', 'haggai.fractal@gmail.com'];
            setIsAdmin(user?.email ? adminEmails.includes(user.email) : false);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
