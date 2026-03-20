'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { Plus, X, Tag as TagIcon, Check, Loader2, Edit2, AlertCircle } from 'lucide-react';

export interface Tag {
    id: string;
    label: string;
    colorHex: string;
    usageCount?: number;
}

interface TagSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    maxTags?: number;
    readOnly?: boolean;
}

const PRESET_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', 
    '#eab308', '#22c55e', '#14b8a6', '#64748b', '#0f172a'
];

export default function TagSelector({ selectedIds, onChange, placeholder = 'Select tags...', maxTags = 10, readOnly = false }: TagSelectorProps) {
    const [open, setOpen] = useState(false);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newTagLabel, setNewTagLabel] = useState('');
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'tags'), orderBy('label'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tagsData: Tag[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
            setAllTags(tagsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching tags:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                setIsCreating(false);
                setErrorMsg('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (tagId: string) => {
        if (readOnly) return;
        if (selectedIds.includes(tagId)) {
            onChange(selectedIds.filter(id => id !== tagId));
        } else {
            if (selectedIds.length >= maxTags) return;
            onChange([...selectedIds, tagId]);
        }
        setSearch('');
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newTagLabel.trim()) return;
        
        setSubmitLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ label: newTagLabel.trim(), colorHex: newTagColor })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to create tag');
            
            // Auto-select the newly created tag
            if (!selectedIds.includes(data.tag.id) && selectedIds.length < maxTags) {
                onChange([...selectedIds, data.tag.id]);
            }
            setIsCreating(false);
            setNewTagLabel('');
            setSearch('');
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setSubmitLoading(false);
        }
    };

    const selectedTags = allTags.filter(t => selectedIds.includes(t.id));
    const unselectedTags = allTags.filter(t => !selectedIds.includes(t.id) && t.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className={`min-h-[42px] px-3 py-1.5 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex flex-wrap items-center gap-2 transition-all ${!readOnly ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50' : 'opacity-80'}`}
                onClick={() => !readOnly && setOpen(!open)}
            >
                {selectedTags.length === 0 && (
                    <span className="text-slate-400 text-sm select-none flex items-center gap-2">
                        <TagIcon className="w-4 h-4" />
                        {placeholder}
                    </span>
                )}
                
                {selectedTags.map(tag => (
                    <div 
                        key={tag.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: `${tag.colorHex}20`, color: tag.colorHex, border: `1px solid ${tag.colorHex}40` }}
                    >
                        {tag.label}
                        {!readOnly && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleSelect(tag.id); }}
                                className="hover:bg-black/10 rounded-full p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {open && !readOnly && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden text-sm flex flex-col max-h-80">
                    
                    {!isCreating ? (
                        <>
                            <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
                                <input 
                                    type="text"
                                    placeholder="Search or create tags..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-zinc-200"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-2">
                                {loading && <div className="p-3 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}
                                
                                {!loading && unselectedTags.length === 0 && search && (
                                    <div className="p-3 text-center text-slate-500 text-sm">
                                        No tags found matching "{search}"
                                    </div>
                                )}

                                {unselectedTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleSelect(tag.id)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.colorHex }}></div>
                                            <span className="font-medium text-slate-700 dark:text-zinc-300">{tag.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="p-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50">
                                <button
                                    onClick={() => {
                                        setNewTagLabel(search);
                                        setIsCreating(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg font-medium transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Create New Tag
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleCreateTag} className="p-4 flex flex-col gap-4">
                            <h3 className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2"><TagIcon className="w-4 h-4"/> New Tag</h3>
                            
                            <div>
                                <label className="text-xs font-semibold text-slate-500 block mb-1">Label</label>
                                <input 
                                    type="text"
                                    required
                                    value={newTagLabel}
                                    onChange={(e) => setNewTagLabel(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Finance, Urgent"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewTagColor(color)}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${newTagColor === color ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-900' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: color }}
                                        >
                                            {newTagColor === color && <Check className="w-3 h-3 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="text-xs text-rose-500 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" /> {errorMsg}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setErrorMsg(''); }}
                                    className="flex-1 px-3 py-2 text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitLoading || !newTagLabel.trim()}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
                                >
                                    {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Tag'}
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            )}
        </div>
    );
}
