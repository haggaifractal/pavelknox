'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Loader2, Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/contexts/AuthContext';

interface AssigneeSelectorProps {
    value?: string | null;
    onChange: (assignee: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
}

export default function AssigneeSelector({ value, onChange, placeholder = 'Select assignee...', readOnly = false, className }: AssigneeSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<{uid: string, displayName: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!user) return;
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            setLoading(true);
            try {
                const res = await fetch('/api/users/list', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUsers(data.users || []);
                }
            } catch (error) {
                console.error("Failed to fetch users", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, [user]);

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

    const handleDeleteCustom = async (e: React.MouseEvent, u: {uid: string, displayName: string}) => {
        e.stopPropagation();
        if (!confirm(`האם לנסות למחוק את האחראי הזמני "${u.displayName}"? מחיקה תתאפשר רק אם אין לו משימות משויכות.`)) return;
        
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/users/custom/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ displayName: u.displayName })
            });
            const data = await res.json();
            if (data.error) {
                alert(data.error);
            } else {
                setUsers(prev => prev.filter(user => user.uid !== u.uid));
                if (value === u.displayName) {
                    onChange('');
                }
                alert(`האחראי "${u.displayName}" נמחק בהצלחה.`);
            }
        } catch (error) {
            console.error('Failed to delete custom user', error);
            alert('שגיאה במחיקת אחראי');
        }
    };

    const filteredUsers = users.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()));
    const exactMatch = users.find(u => u.displayName.toLowerCase() === search.trim().toLowerCase());

    const handleSelect = (assigneeName: string) => {
        onChange(assigneeName);
        setSearch(assigneeName);
        setOpen(false);
    };

    const handleAddNew = () => {
        if (!search.trim()) return;
        handleSelect(search.trim());
    };

    return (
        <div className={cn("relative w-full", className)} ref={wrapperRef}>
            <div className={`relative flex items-center w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all ${open ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-indigo-400 dark:hover:border-indigo-500/50'}`}>
                <div className="pl-3 rtl:pr-3 rtl:pl-0 text-slate-400">
                    <User className="w-4 h-4" />
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
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && search.trim()) {
                            e.preventDefault();
                            handleAddNew();
                        }
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

                        {!loading && filteredUsers.length === 0 && !search && (
                            <div className="p-3 text-center text-slate-500 text-xs">
                                לא נמצאו אחראים. הקלד כדי להוסיף.
                            </div>
                        )}

                        {filteredUsers.map(u => {
                            const isCustom = u.uid.startsWith('custom-');
                            return (
                                <div key={u.uid} className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                                    <button
                                        onClick={() => handleSelect(u.displayName)}
                                        className="flex-1 flex items-center text-left"
                                    >
                                        <span className="font-medium text-slate-700 dark:text-zinc-300">{u.displayName}</span>
                                        {value === u.displayName && <Check className="w-4 h-4 ml-2 rtl:mr-2 text-indigo-600 dark:text-indigo-400" />}
                                    </button>
                                    {isCustom && (
                                        <button
                                            onClick={(e) => handleDeleteCustom(e, u)}
                                            title="מחק אחראי זמני"
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 outline-none shrink-0"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {search.trim() && !exactMatch && (
                            <div className="p-1 border-t border-slate-100 dark:border-zinc-800/50 mt-1">
                                <button
                                    onClick={handleAddNew}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors font-medium text-left outline-none"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="truncate">הוסף אחראי חדש "{search.trim()}" (Enter)</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
