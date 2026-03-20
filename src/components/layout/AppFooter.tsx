'use client';

import { useTranslation } from '@/lib/contexts/LanguageContext';
import Link from 'next/link';

export function AppFooter() {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full border-t border-slate-200 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md mt-auto transition-colors">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                        <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {t('footer.terms')}
                        </Link>
                        <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {t('footer.privacy')}
                        </Link>
                        <Link href="/accessibility" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            {t('footer.accessibility')}
                        </Link>
                    </div>
                    <div className="text-[12px] text-slate-400 dark:text-zinc-500 font-medium text-center sm:text-right">
                        &copy; {currentYear} PavelKnox. {t('footer.allRightsReserved')}
                    </div>
                </div>
            </div>
        </footer>
    );
}
