'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Bot, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function AppHeader() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <nav className="bg-white/80 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800/60 sticky top-0 z-30 backdrop-blur-xl transition-colors">
            <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    
                    <div 
                        className="flex items-center gap-3 cursor-pointer" 
                        onClick={() => router.push('/')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && router.push('/')}
                    >
                        <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10 dark:ring-white/5">
                            <Bot className="text-white w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-zinc-100 hidden sm:block">
                            Pavel<span className="text-indigo-600 dark:text-indigo-400">Knox</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && (
                            <span className="text-[13px] font-medium text-slate-600 dark:text-zinc-500 hidden sm:block bg-slate-100 dark:bg-zinc-900/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-800/50">
                                {user.email}
                            </span>
                        )}
                        <LanguageToggle />
                        <ThemeToggle />
                        {user && (
                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-400 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                title={t('common.logout') || 'Logout'}
                                aria-label={t('common.logout') || 'Logout'}
                            >
                                <LogOut className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </nav>
    );
}
