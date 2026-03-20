'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export type UserRole = 'superadmin' | 'admin' | 'viewer' | null;

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: UserRole;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isViewer: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    role: null, 
    isSuperAdmin: false, 
    isAdmin: false, 
    isViewer: false 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<UserRole>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Force refresh to ensure we have the latest custom claims
                    const tokenResult = await user.getIdTokenResult(true);
                    const userRole = (tokenResult.claims.role as UserRole) || (user.email === 'chagai33@gmail.com' ? 'superadmin' : 'viewer');
                    setRole(userRole);
                } catch (error) {
                    console.error("Failed to get token claims:", error);
                    setRole(user.email === 'chagai33@gmail.com' ? 'superadmin' : 'viewer');
                }
            } else {
                setRole(null);
            }
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const isSuperAdmin = role === 'superadmin';
    const isAdmin = role === 'admin' || isSuperAdmin;
    const isViewer = role === 'viewer' || isAdmin;

    return (
        <AuthContext.Provider value={{ user, loading, role, isSuperAdmin, isAdmin, isViewer }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
