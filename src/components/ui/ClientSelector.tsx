'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useClients } from '@/lib/hooks/useClients';
import { Building2, Search, Plus, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientSelectorProps {
    value?: string | null;
    onChange: (clientName: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
}

export default function ClientSelector({ value, onChange, placeholder = 'Select client...', readOnly = false, className }: ClientSelectorProps) {
    const { clients, loading, addClient } = useClients();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Initialize search with current value if closed
    useEffect(() => {
        if (!open && value) {
            setSearch(value);
        } else if (!open) {
            setSearch('');
        }
    }, [open, value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    const exactMatch = clients.find(c => c.name.toLowerCase() === search.trim().toLowerCase());

    const handleSelect = (clientName: string) => {
        onChange(clientName);
        setSearch(clientName);
        setOpen(false);
    };

    const handleAddNew = async () => {
        if (!search.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await addClient(search.trim());
            handleSelect(search.trim());
        } catch (error) {
            console.error("Failed to add client", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn("relative w-full", className)} ref={wrapperRef}>
            <div className={`relative flex items-center w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all ${open ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-indigo-400 dark:hover:border-indigo-500/50'}`}>
                <div className="pl-3 rtl:pr-3 rtl:pl-0 text-slate-400">
                    <Building2 className="w-4 h-4" />
                </div>
                <input
                    type="text"
                    value={open ? search : (value || '')}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (!open) setOpen(true);
                    }}
                    onFocus={() => {
                        if (readOnly) return;
                        setOpen(true);
                        setSearch(value || '');
                    }}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className="w-full bg-transparent border-none outline-none px-3 py-2 text-sm text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 cursor-text"
                />
            </div>

            {open && !readOnly && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden text-sm flex flex-col max-h-64">
                    <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {loading && (
                            <div className="p-3 flex justify-center text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                        )}

                        {!loading && filteredClients.length === 0 && !search && (
                            <div className="p-3 text-center text-slate-500 text-xs">
                                No clients found. Type to create one.
                            </div>
                        )}

                        {filteredClients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => handleSelect(client.name)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                <span className="font-medium text-slate-700 dark:text-zinc-300">{client.name}</span>
                                {value === client.name && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                            </button>
                        ))}

                        {search.trim() && !exactMatch && (
                            <div className="p-1 border-t border-slate-100 dark:border-zinc-800/50 mt-1">
                                <button
                                    onClick={handleAddNew}
                                    disabled={isSubmitting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors font-medium text-left outline-none"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    <span className="truncate">Add new client "{search.trim()}"</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
