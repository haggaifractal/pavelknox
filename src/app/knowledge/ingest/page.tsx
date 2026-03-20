'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function KnowledgeIngestPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          type: 'article',
          sourceUrl,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || 'Successfully ingested!' });
        setTitle('');
        setContent('');
        setSourceUrl('');
      } else {
        setResult({ success: false, message: data.error || 'Failed to ingest data' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl relative z-20">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-2xl text-slate-100 font-semibold tracking-tight">RAG Ingestion Center</h2>
          <p className="text-slate-400 text-sm mt-1">Convert raw text into mathematical vectors and store them in Firestore for Retrieval-Augmented Generation.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Document Title</label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-md px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                placeholder="e.g. Employee Handbook 2026"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Source URL (Optional)</label>
              <input 
                type="url" 
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-md px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                placeholder="https://example.com/docs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Raw Content</label>
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                rows={12}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-md px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-y"
                placeholder="Paste the raw text content here. It will be automatically chunked and embedded..."
              />
            </div>

            <AnimatePresence>
              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, height: 0 }}
                  className={`p-4 rounded-md flex items-center gap-3 border ${
                    result.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {result.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p className="text-sm font-medium">{result.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              disabled={isSubmitting || !title || !content}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-11"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin text-white/70" />}
              {isSubmitting ? 'Processing Embeddings (This may take a minute)...' : 'Chunk, Embed, and Store Data'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
