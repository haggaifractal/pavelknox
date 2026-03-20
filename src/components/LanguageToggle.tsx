'use client';

import { useTranslation } from '@/lib/contexts/LanguageContext';
import { Languages } from 'lucide-react';
import { motion } from 'framer-motion';

export function LanguageToggle() {
    const { language, setLanguage, t } = useTranslation();

    const toggleLanguage = () => {
        setLanguage(language === 'he' ? 'en' : 'he');
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleLanguage}
            className="p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 rounded-lg transition-colors flex items-center justify-center relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title={t('common.switchLanguage')}
            aria-label={t('common.switchLanguage')}
        >
            <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-zinc-800 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
                {t('common.switchLanguage')}
            </span>
        </motion.button>
    );
}
