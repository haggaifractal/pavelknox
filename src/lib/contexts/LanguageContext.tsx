'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { he } from '@/lib/i18n/he';
import { en } from '@/lib/i18n/en';

export type Language = 'he' | 'en';
export type TranslationKey = typeof he;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = { he, en };

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('he');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('pavelknox-lang') as Language;
        if (stored && (stored === 'he' || stored === 'en')) {
            setLanguageState(stored);
            document.documentElement.dir = stored === 'he' ? 'rtl' : 'ltr';
            document.documentElement.lang = stored;
        } else {
            document.documentElement.dir = 'rtl';
            document.documentElement.lang = 'he';
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('pavelknox-lang', lang);
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    };

    const t = (path: string, params?: Record<string, string | number>) => {
        const [namespace, key] = path.split('.') as [keyof TranslationKey, string];
        const dict = translations[language]?.[namespace] as any;
        let str = dict?.[key] || path;
        
        if (params && typeof str === 'string') {
            Object.keys(params).forEach(p => {
                str = str.replace(`{${p}}`, String(params[p]));
            });
        }
        return str;
    };

    // Prevent hydration mismatch by optionally not rendering children until mounted,
    // though for simple string replacements it's usually fine. We'll render directly to keep it fast.
    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            <div dir={language === 'he' ? 'rtl' : 'ltr'} className="contents">
                {children}
            </div>
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}
