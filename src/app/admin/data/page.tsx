'use client';

import { useState } from 'react';
import AuthGuard from '@/components/ui/AuthGuard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Database, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function AdminDataPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [olderThanDays, setOlderThanDays] = useState('30');
    const [isCleaning, setIsCleaning] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCleanup = async () => {
        if (!confirm(`האם אתה בטוח שברצונך למחוק לצמיתות רשומות raw_inputs ישנות מ-${olderThanDays} ימים?`)) return;

        setIsCleaning(true);
        setResultMessage(null);
        setError(null);

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/admin/cleanup', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    collectionsToClean: ['raw_inputs'],
                    olderThanDays: parseInt(olderThanDays)
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'שגיאה בביצוע הניקוי');

            setResultMessage(`ניקוי הושלם בהצלחה. נמחקו ${data.details?.raw_inputs || 0} רשומות.`);
        } catch (err: any) {
            setError(err.message || 'שגיאה בעת ביצוע הניקוי');
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <AuthGuard requireSuperAdmin>
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                            <Database className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                                {t('common.navAdminData') || 'ניהול נתונים'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                                סקירה וניהול מחזור חיי נתוני המערכת
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Cleanup Panel */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 p-6">
                        <div className="flex items-center gap-2 mb-4 text-rose-600 dark:text-rose-400">
                            <Trash2 className="w-5 h-5" />
                            <h2 className="text-xl font-semibold">ניקוי נתוני מקור (Raw Inputs)</h2>
                        </div>
                        
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                                פעולה זו תמחק לצמיתות רשומות <code>raw_inputs</code> ישנות מהדאטה-בייס. 
                                רשומות אלו משמשות בדרך כלל רק לדיבאג ותקלות אחרונות. 
                                הפעולה תירשם היטב בלוג המערכת (Audit Log).
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    מחק רשומות ישנות מ:
                                </label>
                                <select 
                                    value={olderThanDays}
                                    onChange={(e) => setOlderThanDays(e.target.value)}
                                    disabled={isCleaning}
                                    className="w-full sm:w-64 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all disabled:opacity-50"
                                >
                                    <option value="7">7 ימים</option>
                                    <option value="14">14 ימים</option>
                                    <option value="30">30 ימים</option>
                                    <option value="90">90 ימים</option>
                                    <option value="180">180 ימים</option>
                                </select>
                            </div>
                            
                            <button
                                onClick={handleCleanup}
                                disabled={isCleaning}
                                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2
                                    ${isCleaning ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 shadow-sm hover:shadow-md'}`}
                            >
                                {isCleaning ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        מנקה...
                                    </>
                                ) : (
                                    'בצע ניקוי'
                                )}
                            </button>
                        </div>

                        {resultMessage && (
                            <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30 flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mt-0.5" />
                                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                                    {resultMessage}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="mt-6 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/30 flex items-start gap-3">
                                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-500 mt-0.5" />
                                <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
                                    {error}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
