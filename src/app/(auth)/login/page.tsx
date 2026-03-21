'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { Fingerprint, Loader2, KeyRound, Mail, ArrowRight, ShieldCheck, Zap, Bot, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { cn } from '@/lib/utils';



export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResetMode, setIsResetMode] = useState(false);
    const router = useRouter();
    const { t, language } = useTranslation();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/');
        } catch (err: any) {
            setError(t('login.errorIncorrect'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError(t('login.errorEmailRequired'));
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            await sendPasswordResetEmail(auth, email, {
                url: window.location.origin + '/login',
            });
            setSuccessMsg(t('login.successReset'));
        } catch (err: any) {
            if (err.code === 'auth/invalid-email') {
                setError(t('login.errorInvalidEmail'));
            } else if (err.code === 'auth/user-not-found') {
                setError(t('login.errorUserNotFound'));
            } else {
                setError(t('login.errorGeneric'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 flex w-full h-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 selection:bg-indigo-500/30 transition-colors duration-500">
            
            {/* Global Header handles Language and Theme */}

            {/* Right Panel - Branding & Information (Hidden on small screens) */}
            <div className="hidden lg:flex w-[45%] xl:w-[50%] relative flex-col justify-between p-12 overflow-hidden bg-white dark:bg-zinc-900/40 border-l border-r border-slate-200 dark:border-zinc-800/60 transition-colors">
                
                {/* Abstract Background Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none transition-colors duration-700" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/10 dark:bg-purple-600/10 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none transition-colors duration-700" />
                
                {/* Scrollable container for the content so it doesn't break on shorter screens */}
                <div className="relative z-10 max-w-xl mb-6 overflow-y-auto overflow-x-hidden flex flex-col justify-center h-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <style>{`
                        div::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-3xl xl:text-4xl font-bold leading-[1.25] tracking-tight mb-4"
                    >
                        {t('landing.heroTitle')}
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="text-[15px] xl:text-[16px] text-slate-500 dark:text-zinc-400 font-medium leading-relaxed mb-10"
                    >
                        {t('landing.painPoint')}
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="space-y-8"
                    >
                        <div className="flex gap-4">
                            <div className="h-12 w-12 flex-shrink-0 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                <Mic className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-lg mb-1">{t('landing.featVoiceTitle')}</h3>
                                <p className="text-[15px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                                    {t('landing.featVoiceDesc')}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="h-12 w-12 flex-shrink-0 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                <Bot className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-lg mb-1">{t('landing.featChatTitle')}</h3>
                                <p className="text-[15px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                                    {t('landing.featChatDesc')}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="h-12 w-12 flex-shrink-0 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-lg mb-1">{t('landing.featHumanTitle')}</h3>
                                <p className="text-[15px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                                    {t('landing.featHumanDesc')}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Left Panel - Login Form */}
            <main className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
                
                {/* Mobile Logo Only */}
                <div className="lg:hidden flex justify-center mb-10">
                    <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-1 ring-black/5 dark:ring-white/10" aria-hidden="true">
                        <Fingerprint className="text-white h-8 w-8" strokeWidth={1.5} />
                    </div>
                </div>

                <div className="mx-auto w-full max-w-md">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 transition-colors">
                            {isResetMode ? t('login.resetTitle') : t('login.title')}
                        </h2>
                        <p className="text-[15px] text-slate-500 dark:text-zinc-400 font-medium transition-colors">
                            {isResetMode ? t('login.resetSubtitle') : t('login.subtitle')}
                        </p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="mt-8"
                    >
                        <form className="space-y-6" onSubmit={isResetMode ? handleReset : handleLogin} noValidate>
                            
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 transition-colors">
                                        {t('login.email')}
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        autoComplete="username"
                                        dir="ltr"
                                        className="block w-full px-4 py-3.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all text-[15px] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 shadow-sm"
                                        placeholder="admin@pavelknox.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        aria-invalid={!!error && !password}
                                    />
                                </div>

                                <AnimatePresence mode="wait">
                                    {!isResetMode && (
                                        <motion.div
                                            key="password-field"
                                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-2 origin-top"
                                        >
                                            <div className="flex justify-between items-center">
                                                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 transition-colors">
                                                    {t('login.password')}
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsResetMode(true);
                                                        setError('');
                                                        setSuccessMsg('');
                                                    }}
                                                    className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                >
                                                    {t('login.forgotPassword')}
                                                </button>
                                            </div>
                                            <input
                                                id="password"
                                                type="password"
                                                required={!isResetMode}
                                                autoComplete="current-password"
                                                dir="ltr"
                                                className="block w-full px-4 py-3.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all text-[15px] text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 shadow-sm"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div aria-live="polite" aria-atomic="true">
                                <AnimatePresence mode="wait">
                                    {error && (
                                        <motion.div 
                                            key="error-msg"
                                            initial={{ opacity: 0, height: 0, y: -10 }}
                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -10 }}
                                            className="text-red-700 dark:text-red-400 text-[14px] font-medium bg-red-50 dark:bg-red-950/30 py-3 px-4 rounded-xl border border-red-200 dark:border-red-900/50 transition-colors flex items-center mb-4"
                                            role="alert"
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400 mr-2 ml-2 flex-shrink-0 animate-pulse" />
                                            {error}
                                        </motion.div>
                                    )}
                                    {successMsg && (
                                        <motion.div 
                                            key="success-msg"
                                            initial={{ opacity: 0, height: 0, y: -10 }}
                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -10 }}
                                            className="text-emerald-700 dark:text-emerald-400 text-[14px] font-medium bg-emerald-50 dark:bg-emerald-950/30 py-3 px-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 transition-colors flex items-center mb-4"
                                            role="status"
                                        >
                                            <ShieldCheck className="w-4 h-4 mr-2 ml-2 flex-shrink-0" aria-hidden="true" />
                                            {successMsg}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={cn(
                                        "w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md text-[15px] font-bold text-white transition-all",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
                                        "disabled:opacity-60 disabled:cursor-not-allowed",
                                        isResetMode 
                                            ? "bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white focus-visible:ring-slate-900 dark:focus-visible:ring-zinc-100" 
                                            : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30 focus-visible:ring-indigo-500 active:scale-[0.98]"
                                    )}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="animate-spin h-5 w-5 mx-2" aria-hidden="true" />
                                            {isResetMode ? t('login.buttonResetLoading') : t('login.buttonLoginLoading')}
                                        </>
                                    ) : isResetMode ? (
                                        <>
                                            <Mail className="h-5 w-5 mx-2 opacity-80" aria-hidden="true" />
                                            {t('login.buttonReset')}
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound className="h-5 w-5 mx-2 opacity-80" aria-hidden="true" />
                                            {t('login.buttonLogin')}
                                        </>
                                    )}
                                </button>
                                
                                <AnimatePresence mode="wait">
                                    {isResetMode && (
                                        <motion.div
                                            key="back-to-login"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsResetMode(false);
                                                    setError('');
                                                    setSuccessMsg('');
                                                }}
                                                className="w-full flex justify-center items-center mt-4 py-3 px-4 text-[14px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                            >
                                                {t('login.backToLogin')}
                                                <ArrowRight className="h-4 w-4 mx-2" aria-hidden="true" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </form>
                    </motion.div>
                </div>
                
            </main>
        </div>
    );
}
