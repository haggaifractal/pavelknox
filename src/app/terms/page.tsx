'use client';

import { useTranslation } from '@/lib/contexts/LanguageContext';

export default function TermsPage() {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 p-8 md:p-12">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mb-6 font-sans">
                    {t('termsPage.title')}
                </h1>
                <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-zinc-400">
                    <p className="text-lg leading-relaxed">{t('termsPage.content')}</p>
                    {/* Add more terms content as needed */}
                </div>
            </div>
        </div>
    );
}
