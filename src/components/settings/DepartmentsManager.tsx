import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { useTranslation } from '@/lib/contexts/LanguageContext';

interface UserData {
    uid: string;
    email: string;
    departmentIds?: string[];
    [key: string]: any;
}

interface Department {
    id: string;
    name: string;
    createdAt?: any;
}

interface DepartmentsManagerProps {
    users?: UserData[];
    onUserDepartmentChange?: (uid: string, newDepartmentIds: string[]) => Promise<void>;
}

export default function DepartmentsManager({ users = [], onUserDepartmentChange }: DepartmentsManagerProps) {
    const { isSuperAdmin, user } = useAuth();
    const { t, language } = useTranslation();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [newName, setNewName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isSuperAdmin) return;

        const q = query(collection(db, 'departments'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const deps = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Department[];
            setDepartments(deps);
        });

        return () => unsubscribe();
    }, [isSuperAdmin]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !isSuperAdmin || submitting) return;

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'departments'), {
                name: newName.trim(),
                createdAt: serverTimestamp(),
                createdBy: user?.uid
            });
            setNewName('');
        } catch (error: any) {
            console.error('Error creating department:', error);
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!isSuperAdmin) return;
        if (!confirm(t('settings.deleteDepartmentConfirm').replace('{name}', name))) return;

        try {
            await deleteDoc(doc(db, 'departments', id));
        } catch (error: any) {
            console.error('Error deleting department:', error);
            alert(error.message);
        }
    };

    if (!isSuperAdmin) return null;

    return (
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-100">
                    <Building2 className="w-5 h-5 text-indigo-500" /> 
                    {t('settings.departmentsTitle')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                    {t('settings.departmentsDesc')}
                </p>
            </div>

            <div className="p-6">
                <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end mb-8">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold mb-2 text-slate-500">{t('settings.departmentNameLabel')}</label>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder={t('settings.departmentNamePlaceholder')}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newName.trim() || submitting}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {t('settings.addDepartmentBtn')}
                    </button>
                </form>

                {departments.length > 0 ? (
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left rtl:text-right">
                            <thead className="bg-slate-50 dark:bg-zinc-950/50 text-slate-600 dark:text-zinc-400 text-xs font-semibold border-b border-slate-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 w-48">{t('settings.departmentNameLabel')}</th>
                                    <th className="px-6 py-3">משתמשים משויכים</th>
                                    <th className="px-6 py-3 text-center w-24">{t('settings.tableActions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {departments.map(dep => (
                                    <tr key={dep.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-zinc-200 align-top pt-5">{dep.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {users.filter(u => u.departmentIds?.includes(dep.id)).map(u => (
                                                    <span key={u.uid} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                                        {u.email}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (onUserDepartmentChange) {
                                                                    const newIds = u.departmentIds!.filter(id => id !== dep.id);
                                                                    onUserDepartmentChange(u.uid, newIds);
                                                                }
                                                            }}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors mr-1 rtl:mr-0 rtl:ml-1 py-0.5"
                                                            title="הסר משתמש מהמחלקה"
                                                        >
                                                            &times;
                                                        </button>
                                                    </span>
                                                ))}
                                                {users.filter(u => u.departmentIds?.includes(dep.id)).length === 0 && (
                                                    <span className="text-slate-400 text-xs italic py-1.5">אין משתמשים משויכים</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(dep.id, dep.name)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800">
                        {t('settings.noDepartments')}
                    </div>
                )}
            </div>
        </section>
    );
}
