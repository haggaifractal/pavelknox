'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/contexts/LanguageContext';

interface Department {
    id: string;
    name: string;
}

interface DepartmentSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function DepartmentSelector({ selectedIds, onChange, placeholder, disabled = false }: DepartmentSelectorProps) {
    const { t } = useTranslation();
    const defaultPlaceholder = placeholder || t('settings.departmentSelectPlaceholder');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const q = query(collection(db, 'departments'), orderBy('name'));
                const querySnapshot = await getDocs(q);
                const fetched: Department[] = [];
                querySnapshot.forEach((doc) => {
                    fetched.push({ id: doc.id, ...doc.data() } as Department);
                });
                setDepartments(fetched);
            } catch (error) {
                console.error("Error fetching departments:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDepartments();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDepartment = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const selectedDepartments = departments.filter(d => selectedIds.includes(d.id));

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-[13px] rounded-lg px-3 py-2 shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-300 dark:hover:border-zinc-700 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={disabled}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">
                        {loading ? t('common.loading') : 
                         selectedDepartments.length > 0 
                            ? selectedDepartments.map(d => d.name).join(', ') 
                            : defaultPlaceholder}
                    </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                    {departments.length === 0 ? (
                        <div className="px-4 py-3 text-[13px] text-slate-500 dark:text-zinc-500 text-center">
                            {t('settings.noDepartmentsFound')}
                        </div>
                    ) : (
                        <ul className="py-1">
                            {departments.map(dept => {
                                const isSelected = selectedIds.includes(dept.id);
                                return (
                                    <li
                                        key={dept.id}
                                        onClick={() => toggleDepartment(dept.id)}
                                        className={`px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-slate-700 dark:text-zinc-300'}`}
                                    >
                                        <span>{dept.name}</span>
                                        {isSelected && <Check className="w-4 h-4" />}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

