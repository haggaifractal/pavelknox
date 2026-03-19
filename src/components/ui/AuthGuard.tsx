'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    return <>{children}</>;
}
