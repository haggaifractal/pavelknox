'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Bot, LogOut, Menu, X } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AppHeader() {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


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
            <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div className="flex justify-between h-16">
                    
                    <Link 
                        href="/"
                        className="flex items-center gap-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg" 
                    >
                        <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10 dark:ring-white/5">
                            <Bot className="text-white w-5 h-5" aria-hidden="true" />
                        </div>
                        <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-zinc-100 hidden sm:block">
                            Pavel<span className="text-indigo-600 dark:text-indigo-400">Knox</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {user && (
                            <>
                                {/* Desktop Primary Navigation */}
                                <div className="hidden sm:flex items-center gap-4 mr-2 rtl:ml-2">
                                    <Link
                                        href="/"
                                        className="flex items-center gap-1.5 text-[14px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-1.5"
                                    >
                                        {t('dashboard.btnKnowledgeBase') || 'מאגר ידע'}
                                    </Link>
                                    
                                    {(isAdmin || isSuperAdmin) && (
                                        <Link
                                            href="/clients"
                                            className="text-[14px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-1.5"
                                        >
                                            {t('common.navClients') || 'לקוחות'}
                                        </Link>
                                    )}

                                    <Link
                                        href="/tasks"
                                        className="text-[14px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100/50 dark:bg-zinc-800/30 px-3 py-1.5 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20"
                                    >
                                        {t('common.navTasks') || 'משימות'}
                                    </Link>
                                    
                                    <span className="text-[13px] font-medium text-slate-600 dark:text-zinc-500 hidden xl:block bg-slate-100 dark:bg-zinc-900/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-zinc-800/50">
                                        {user.email}
                                    </span>
                                </div>
                                
                                {/* Always Visible Hamburger Menu Toggle */}
                                <div className="flex items-center mr-2 rtl:ml-2">
                                    <button
                                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                        className="p-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                                    >
                                        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                                    </button>
                                </div>
                            </>
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

                {/* Dropdown Menu (Mobile + Desktop secondary items) */}
                {isMobileMenuOpen && user && (
                    <div className="absolute rtl:left-0 rtl:right-auto ltr:right-0 ltr:left-auto sm:rtl:left-6 sm:ltr:right-6 top-16 w-full sm:w-64 border-b sm:border sm:rounded-b-2xl sm:shadow-2xl border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 z-40 transform origin-top">
                        
                        {/* Mobile Only Links (Shown in hamburger on mobile, but main header on desktop) */}
                        <div className="sm:hidden flex flex-col gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                            <Link
                                        href="/"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center justify-between text-left text-[15px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-2.5 rounded-lg"
                                    >
                                        <span>{t('dashboard.btnKnowledgeBase') || 'מאגר ידע'}</span>
                                    </Link>
                            {(isAdmin || isSuperAdmin) && (
                                <Link
                                    href="/clients"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-left text-[15px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                                >
                                    {t('common.navClients') || 'לקוחות'}
                                </Link>
                            )}
                            <Link
                                href="/tasks"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="text-left text-[15px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                            >
                                {t('common.navTasks') || 'משימות'}
                            </Link>
                        </div>

                        {/* All screen links (Secondary navigation) */}
                        <Link
                            href="/drafts"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-left text-[15px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                        >
                            {t('dashboard.title') || 'טיוטות'}
                        </Link>

                        {(isAdmin || isSuperAdmin) && (
                            <Link
                                href="/tags"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="text-left text-[15px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                            >
                                {t('common.navTags') || 'תגיות'}
                            </Link>
                        )}

                        {isSuperAdmin && (
                            <>
                                <Link
                                    href="/admin/tokens"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-left text-[15px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                                >
                                    {t('common.navAdminTokens') || 'Token Quotas'}
                                </Link>
                                <Link
                                    href="/admin/data"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-left text-[15px] font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                                >
                                    {t('common.navAdminData') || 'Admin Data'}
                                </Link>
                                <Link
                                    href="/settings"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-left text-[15px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors px-3 py-2.5 rounded-lg block"
                                >
                                    {t('settings.title') || 'Team Management'}
                                </Link>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
