'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function AuthGuard({ 
    children,
    requireAdmin,
    requireSuperAdmin
}: { 
    children: React.ReactNode;
    requireAdmin?: boolean;
    requireSuperAdmin?: boolean;
}) {
    const { user, loading, isAdmin, isSuperAdmin } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
                return;
            }

            if (requireSuperAdmin && !isSuperAdmin) {
                router.push('/');
                return;
            }

            if (requireAdmin && !isAdmin && !isSuperAdmin) {
                router.push('/');
                return;
            }
        }
    }, [user, loading, router, requireAdmin, requireSuperAdmin, isAdmin, isSuperAdmin]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    return <>{children}</>;
}
