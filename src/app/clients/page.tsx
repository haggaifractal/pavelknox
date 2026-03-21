'use client';

import AuthGuard from '@/components/ui/AuthGuard';
import { useTranslation } from '@/lib/contexts/LanguageContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Users, Trash2, Plus, Loader2, AlertCircle, Upload, Download, X, Edit2, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import { useClients, Client } from '@/lib/hooks/useClients';

export default function ClientsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { clients, loading, error, addClient, updateClient, importClients } = useClients();
    
    const [isAddMode, setIsAddMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '', contactPerson: '', phone: '', email: '', address: ''
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState('');
    const [importing, setImporting] = useState(false);
    
    // Edit states
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Client>>({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    
    // New states for CSV Preview & Bulk Delete
    const [importPreviewData, setImportPreviewData] = useState<{ client: Omit<Client, 'id'|'createdAt'>, isValid: boolean, error?: string, idx: number }[]>([]);
    const [selectedForImport, setSelectedForImport] = useState<number[]>([]);
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        if (formData.name.length > 100) {
            setActionError('שם הלקוח ארוך מדי (מקסימום 100 תווים)');
            return;
        }
        if (formData.contactPerson.length > 100) {
            setActionError('שם איש קשר ארוך מדי (מקסימום 100 תווים)');
            return;
        }
        if (formData.email.length > 100) {
            setActionError('אימייל ארוך מדי (מקסימום 100 תווים)');
            return;
        }
        if (formData.address.length > 200) {
            setActionError('כתובת ארוכה מדי (מקסימום 200 תווים)');
            return;
        }
        if (formData.phone) {
            const cleanPhone = formData.phone.replace(/[-\s]/g, '');
            if (!/^(05|07|\+972)\d{7,8}$/.test(cleanPhone)) {
                setActionError('מספר טלפון לא תקין (חייב להתחיל ב-05, 07 או +972 להיות באורך תקין)');
                return;
            }
        }

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

    const handleSaveEdit = async () => {
        if (!editingClientId || !editFormData.name?.trim()) return;
        setIsSavingEdit(true);
        setActionError('');
        try {
            await updateClient(editingClientId, editFormData as Omit<Client, 'id' | 'createdAt'>);
            setEditingClientId(null);
        } catch (err: any) {
            setActionError(err.message || 'Failed to update client.');
        } finally {
            setIsSavingEdit(false);
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
            setSelectedClientIds(prev => prev.filter(id => id !== clientId));
        } catch (err: any) {
            console.error('Error deleting client:', err);
            setActionError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedClientIds.length) return;
        if (!confirm(`Are you sure you want to delete ${selectedClientIds.length} select clients?\nNotice: This action cannot be undone.`)) {
            return;
        }

        setIsBulkDeleting(true);
        setActionError('');

        try {
            const token = await user?.getIdToken(true);
            const res = await fetch('/api/clients/bulk-delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ clientIds: selectedClientIds })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to bulk delete clients');
            }
            setSelectedClientIds([]);
        } catch (err: any) {
            console.error('Error in bulk delete:', err);
            setActionError(err.message);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const toggleClientSelection = (id: string) => {
        setSelectedClientIds(prev => prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]);
    };

    const toggleAllClients = () => {
        if (selectedClientIds.length === clients.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(clients.map(c => c.id));
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

            const importData: { client: Omit<Client, 'id'|'createdAt'>, isValid: boolean, error?: string, idx: number }[] = [];
            let startIdx = 0;
            if (rows[0] && rows[0][0] && rows[0][0].toLowerCase().includes('name')) {
                startIdx = 1;
            }

            for (let i = startIdx; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0] && !row[1] && !row[2]) continue; // Skip completely empty rows
                
                const client = {
                    name: row[0]?.trim() || '',
                    contactPerson: row[1]?.trim() || '',
                    phone: row[2]?.trim() || '',
                    email: row[3]?.trim() || '',
                    address: row[4]?.trim() || ''
                };

                let isValid = true;
                let error = '';

                if (!client.name) {
                    isValid = false;
                    error = 'שם לקוח חסר';
                } else if (client.name.length > 100) {
                    isValid = false;
                    error = 'שם הלקוח ארוך מ-100 תווים';
                }

                if (client.phone && isValid) {
                    const cleanPhone = client.phone.replace(/[-\s]/g, '');
                    if (!/^(05|07|\+972)\d{7,8}$/.test(cleanPhone)) {
                        isValid = false;
                        error = 'מספר טלפון לא תקין';
                    }
                }

                importData.push({ client, isValid, error, idx: i });
            }

            if (importData.length === 0) {
                throw new Error("לא נמצאו נתונים תקינים מתוך קובץ ה-CSV. נדרשות העמודות הבאות: מזהה/שם, איש קשר, טלפון.");
            }

            setImportPreviewData(importData);
            setSelectedForImport(importData.filter(d => d.isValid).map(d => d.idx));
        } catch (err: any) {
            setActionError(err.message || 'Failed to read CSV');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedForImport.length) return;
        setImporting(true);
        setActionError('');
        
        try {
            const dataToImport = importPreviewData
                .filter(d => selectedForImport.includes(d.idx))
                .map(d => d.client);
                
            const count = await importClients(dataToImport);
            alert(`יובאו ${count} לקוחות בהצלחה.`);
            setImportPreviewData([]);
            setSelectedForImport([]);
        } catch (err: any) {
            setActionError(err.message || 'Failed to import CSV');
        } finally {
            setImporting(false);
        }
    };

    const cancelImportPreview = () => {
        setImportPreviewData([]);
        setSelectedForImport([]);
        setActionError('');
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
                                    maxLength={100}
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">איש קשר</label>
                                <input
                                    type="text"
                                    maxLength={100}
                                    value={formData.contactPerson}
                                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm transition-shadow text-black dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">טלפון</label>
                                <input
                                    type="tel"
                                    maxLength={20}
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
                                    maxLength={100}
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
                                    maxLength={200}
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

                {importPreviewData.length > 0 && (
                    <div className="mb-8 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">תצוגה מקדימה של נתוני הייבוא</h3>
                            <button onClick={cancelImportPreview} className="text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto max-h-96 overflow-y-auto mb-4 border border-slate-200 dark:border-zinc-700 rounded-lg">
                            <table className="w-full text-sm text-left rtl:text-right text-slate-600 dark:text-zinc-400">
                                <thead className="text-xs uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedForImport.length === importPreviewData.filter(d => d.isValid).length && importPreviewData.filter(d => d.isValid).length > 0} 
                                                onChange={(e) => setSelectedForImport(e.target.checked ? importPreviewData.filter(d => d.isValid).map(d => d.idx) : [])}
                                                className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-4 py-3">שם / חברה</th>
                                        <th className="px-4 py-3">איש קשר</th>
                                        <th className="px-4 py-3">טלפון</th>
                                        <th className="px-4 py-3 hidden md:table-cell">אימייל</th>
                                        <th className="px-4 py-3 hidden lg:table-cell">כתובת</th>
                                        <th className="px-4 py-3">סטטוס</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreviewData.map((row) => (
                                        <tr key={row.idx} className={`border-b dark:border-zinc-700 transition-colors ${row.isValid ? 'bg-white dark:bg-zinc-900' : 'bg-red-50 dark:bg-red-900/10'}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    disabled={!row.isValid}
                                                    checked={selectedForImport.includes(row.idx)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedForImport([...selectedForImport, row.idx]);
                                                        else setSelectedForImport(selectedForImport.filter(id => id !== row.idx));
                                                    }}
                                                    className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-zinc-100">{row.client.name}</td>
                                            <td className="px-4 py-3">{row.client.contactPerson}</td>
                                            <td className="px-4 py-3" dir="ltr">{row.client.phone}</td>
                                            <td className="px-4 py-3 hidden md:table-cell" dir="ltr">{row.client.email}</td>
                                            <td className="px-4 py-3 hidden lg:table-cell">{row.client.address}</td>
                                            <td className="px-4 py-3 text-xs font-semibold">
                                                {row.isValid 
                                                    ? <span className="text-green-600 dark:text-green-400">תקין</span>
                                                    : <span className="text-red-600 dark:text-red-400">{row.error}</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="flex justify-end items-center gap-4">
                            <span className="text-sm font-medium text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700">נבחרו {selectedForImport.length} מתוך {importPreviewData.length} מועמדים</span>
                            <button
                                onClick={handleConfirmImport}
                                disabled={importing || selectedForImport.length === 0}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                                אישור וייבוא {selectedForImport.length} שורות
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                    {/* Bulk Delete Header Actions */}
                    {selectedClientIds.length > 0 && (
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20 px-6 py-3 flex justify-between items-center transition-all animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-medium text-sm">
                                <span className="flex items-center justify-center bg-indigo-200 dark:bg-indigo-600/30 w-6 h-6 rounded-full text-xs">{selectedClientIds.length}</span>
                                לקוחות נבחרו
                            </div>
                            <button 
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                מחיקת נבחרים
                            </button>
                        </div>
                    )}
                    {/* Header Row for Select All */}
                    {!loading && clients.length > 0 && (
                        <div className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-3 flex items-center gap-4">
                            <input 
                                type="checkbox"
                                checked={selectedClientIds.length === clients.length && clients.length > 0}
                                onChange={toggleAllClients}
                                className="w-4 h-4 text-indigo-600 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">בחר הכל ({clients.length})</span>
                        </div>
                    )}

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
                                <div key={client.id} className={`p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start gap-4 group ${selectedClientIds.includes(client.id) ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`}>
                                    <div className="pt-1">
                                        <input 
                                            type="checkbox"
                                            checked={selectedClientIds.includes(client.id)}
                                            onChange={() => toggleClientSelection(client.id)}
                                            className="w-4 h-4 text-indigo-600 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 rounded focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </div>
                                    
                                    {editingClientId === client.id ? (
                                        <div className="flex flex-col flex-1 gap-2">
                                            <input
                                                type="text"
                                                value={editFormData.name || ''}
                                                onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 rounded-md text-sm font-semibold text-slate-900 dark:text-zinc-100"
                                                placeholder="שם הלקוח"
                                                autoFocus
                                            />
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                <input
                                                    type="text"
                                                    value={editFormData.contactPerson || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, contactPerson: e.target.value})}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md"
                                                    placeholder="איש קשר"
                                                />
                                                <input
                                                    type="tel"
                                                    value={editFormData.phone || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md"
                                                    placeholder="טלפון"
                                                    dir="ltr"
                                                />
                                                <input
                                                    type="email"
                                                    value={editFormData.email || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md"
                                                    placeholder="אימייל"
                                                    dir="ltr"
                                                />
                                                <input
                                                    type="text"
                                                    value={editFormData.address || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                                                    className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-md md:col-span-2"
                                                    placeholder="כתובת"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 mt-1">
                                                <button
                                                    onClick={() => setEditingClientId(null)}
                                                    className="px-3 py-1.5 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md text-sm transition-colors"
                                                >
                                                    ביטול
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={isSavingEdit || !editFormData.name?.trim()}
                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                                                >
                                                    {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    שמור
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col flex-1">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1">
                                                <span className="font-semibold text-lg text-slate-900 dark:text-zinc-100">{client.name}</span>
                                                {client.createdAt && (
                                                    <span className="text-xs text-slate-400 dark:text-zinc-500 hidden md:inline-block">
                                                        נוסף ב- {new Date(client.createdAt).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}
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
                                    )}

                                    <div className="flex items-center ml-4 mt-1 gap-1">
                                        {editingClientId !== client.id && (
                                            <button
                                                onClick={() => {
                                                    setEditingClientId(client.id);
                                                    setEditFormData({...client});
                                                }}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Edit client"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}
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
