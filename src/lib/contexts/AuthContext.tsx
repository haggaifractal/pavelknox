'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export type UserRole = 'superadmin' | 'admin' | 'viewer' | null;

export interface UserPermissions {
    canAccessKnowledgeControl: boolean;
    canCreateTasks: boolean;
    canEditTasks: boolean;
    canDeleteTasks: boolean;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
    canAccessKnowledgeControl: false,
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
};

const ADMIN_PERMISSIONS: UserPermissions = {
    canAccessKnowledgeControl: true,
    canCreateTasks: true,
    canEditTasks: true,
    canDeleteTasks: true,
};

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: UserRole;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isViewer: boolean;
    permissions: UserPermissions;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    role: null, 
    isSuperAdmin: false, 
    isAdmin: false, 
    isViewer: false,
    permissions: DEFAULT_PERMISSIONS
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<UserRole>(null);
    const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setLoading(true);
                try {
                    // First ensure we have token claims for fast rendering
                    // Do NOT force refresh every time to save network, it will auto-refresh if expired
                    const tokenResult = await firebaseUser.getIdTokenResult();
                    const userRole = (tokenResult.claims.role as UserRole) || 'viewer';
                    setRole(userRole);

                    // Then fetch specific document for granular permissions
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        // Use DB role if available (it updates instantly compared to custom claims)
                        const dbRole = (userData.role as UserRole) || userRole;
                        setRole(dbRole); // Update state to reflect true DB role
                        
                        // Base permissions depend on true role
                        const basePermissions = (dbRole === 'admin' || dbRole === 'superadmin') ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS;

                        if (userData.permissions) {
                            // Merge fetched permissions with base to guarantee interface completeness
                            setPermissions({
                                ...basePermissions,
                                ...userData.permissions
                            });
                        } else {
                            // If user document exists but no explicit permissions object, fallout back to role-based
                            setPermissions(basePermissions);
                        }
                    } else {
                        // Fallback logic if document doesn't exist yet
                        setPermissions(userRole === 'admin' || userRole === 'superadmin' ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS);
                    }
                    
                    setUser(firebaseUser);

                } catch (error: any) {
                    console.error("Failed to fetch user permissions/claims. Token might be invalid or expired:", error);
                    // Force log out if token is dead (e.g., 400 securetoken error)
                    await auth.signOut().catch(console.error);
                    setRole(null);
                    setPermissions(DEFAULT_PERMISSIONS);
                    setUser(null);
                }
            } else {
                setRole(null);
                setPermissions(DEFAULT_PERMISSIONS);
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const isSuperAdmin = role === 'superadmin';
    const isAdmin = role === 'admin' || isSuperAdmin;
    const isViewer = role === 'viewer' || isAdmin;

    // Optional Safety: Even if doc was missing, if token confirms admin, grant admin permissions broadly. (Adjust depending on strictness needed)

    return (
        <AuthContext.Provider value={{ user, loading, role, isSuperAdmin, isAdmin, isViewer, permissions }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
