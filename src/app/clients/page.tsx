'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Users, Trash2, Plus, Loader2, AlertCircle, Upload, Download, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { useClients, Client } from '@/lib/hooks/useClients';

export default function ClientsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { clients, loading, error, addClient, importClients } = useClients();
    
    const [isAddMode, setIsAddMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '', contactPerson: '', phone: '', email: '', address: ''
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setIsSubmitting(true);
        setActionError('');
        try {
            await addClient(formData);
            setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '' });
            setIsAddMode(false);
        } catch (err: any) {
            setActionError(err.message || 'Failed to add client.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (clientId: string, clientName: string) => {
        if (!confirm(`Are you sure you want to delete the client "${clientName}"?\nNotice: Proceed with caution, as this action cannot be undone.`)) {
            return;
        }

        setDeletingId(clientId);
        setActionError('');

        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/clients/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id: clientId, name: clientName })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete client');
            }
        } catch (err: any) {
            console.error('Error deleting client:', err);
            setActionError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setActionError('');
        try {
            const text = await file.text();
            
            // Handle different line endings and respect quoted strings containing commas
            const rows: string[][] = [];
            let inQuotes = false;
            let currentCell = '';
            let currentRow: string[] = [];
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"' && text[i+1] === '"') {
                    currentCell += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    currentRow.push(currentCell.trim());
                    currentCell = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (char === '\r' && text[i+1] === '\n') i++; // Skip \n in \r\n
                    currentRow.push(currentCell.trim());
                    if (currentRow.join('').trim() !== '') {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
            }

            const importData: Omit<Client, 'id'|'createdAt'>[] = [];
            let startIdx = 0;
            if (rows[0] && rows[0][0] && rows[0][0].toLowerCase().includes('name')) {
                startIdx = 1;
            }

            for (let i = startIdx; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;
                
                importData.push({
                    name: row[0] || '',
                    contactPerson: row[1] || '',
                    phone: row[2] || '',
                    email: row[3] || '',
                    address: row[4] || ''
                });
            }

            if (importData.length === 0) {
                throw new Error("No valid client data found in CSV file. Expected columns: Name, Contact Person, Phone, Email, Address.");
            }

            const count = await importClients(importData);
            alert(`Successfully imported ${count} clients.`);
        } catch (err: any) {
            setActionError(err.message || 'Failed to import CSV');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const downloadCsvTemplate = () => {
        const headers = ["Name", "Contact Person", "Phone", "Email", "Address"];
        // Ensure proper utf-8 BOM for Hebrew characters in Excel
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(headers.join(","));
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "clients_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AuthGuard requireAdmin>
            <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-zinc-800 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
                            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                                {t('common.navClients') || 'Clients / לקוחות'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                                ניהול רשימת לקוחות וייבוא
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={downloadCsvTemplate}
                            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">תבנית לייבוא</span>
                        </button>
                        
                        <label className={`px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span className="hidden sm:inline">ייבוא לקוחות</span>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleImportCSV}
                                ref={fileInputRef}
                                disabled={importing}
                            />
                        </label>

                        <button
                            onClick={() => setIsAddMode(!isAddMode)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            {isAddMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            <span className="hidden sm:inline">{isAddMode ? 'ביטול' : 'הוסף לקוח הלקוחה'}</span>
                        </button>
                    </div>
                </div>

                {(error || actionError) && (
                    <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{actionError || error?.message}</p>
                    </div>
                )}

                {isAddMode && (
                    <div className="mb-8 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">הוספת לקוח/ה חדש/ה</h3>
                        <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">שם הלקוח/ה *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">איש קשר</label>
                                <input
                                    type="text"
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">טלפון</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">אימייל</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                    dir="ltr"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">כתובת</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                />
                            </div>
                            <div className="md:col-span-2 flex justify-end mt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !formData.name.trim()}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isSubmitting ? 'שומר...' : 'שמור לקוח/ה'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : clients.length === 0 ? (
                        <div className="text-center py-20">
                            <Users className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-100">לא נמצאו לקוחות</h3>
                            <p className="text-slate-500 dark:text-zinc-400 mt-1">הוסף לקוח חדש או בצע ייבוא רשימה.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                            {clients.map(client => (
                                <div key={client.id} className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start justify-between group">
                                    <div className="flex flex-col flex-1">
                                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1">
                                            <span className="font-semibold text-lg text-slate-900 dark:text-zinc-100">{client.name}</span>
                                            {client.createdAt && (
                                                <span className="text-xs text-slate-400 dark:text-zinc-500 hidden md:inline-block">
                                                    נוסף ב- {new Date(client.createdAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-slate-600 dark:text-zinc-400">
                                            {client.contactPerson && (
                                                <div><span className="font-medium text-slate-700 dark:text-zinc-300">איש קשר:</span> {client.contactPerson}</div>
                                            )}
                                            {client.phone && (
                                                <div><span className="font-medium text-slate-700 dark:text-zinc-300">טלפון:</span> <span dir="ltr">{client.phone}</span></div>
                                            )}
                                            {client.email && (
                                                <div><span className="font-medium text-slate-700 dark:text-zinc-300">אימייל:</span> <span dir="ltr">{client.email}</span></div>
                                            )}
                                            {client.address && (
                                                <div className="md:col-span-2"><span className="font-medium text-slate-700 dark:text-zinc-300">כתובת:</span> {client.address}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center ml-4 mt-1">
                                        <button
                                            onClick={() => handleDelete(client.id, client.name)}
                                            disabled={deletingId === client.id}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
                                            title="Delete client"
                                        >
                                            {deletingId === client.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
