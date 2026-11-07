import React, { useState, useEffect } from 'react';
import { X, BookOpen, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { createArticle, updateArticle, deleteArticle } from '../services/ticketService';
import { useToast } from '../context/ToastContext';

const CATEGORIES = [
  { value: 'TECHNICAL', label: 'Technical & Platform Issues' },
  { value: 'PAYMENTS_UPI', label: 'Payments, UPI & Gateway' },
  { value: 'BILLING', label: 'Billing, Invoices & Subscriptions' },
  { value: 'ACCOUNT', label: 'Account, Security & Access' },
  { value: 'GENERAL', label: 'General Helpdesk & SLAs' },
];

const STATUSES = [
  { value: 'PUBLISHED', label: 'Published (Publicly Visible)' },
  { value: 'DRAFT', label: 'Draft (Staff Only)' },
  { value: 'ARCHIVED', label: 'Archived (Hidden)' },
];

export default function ArticleEditorModal({
  isOpen,
  onClose,
  onSaved,
  initialArticle = null,
}) {
  const { addToast } = useToast();
  const isEditing = Boolean(initialArticle && initialArticle._id);

  const [formData, setFormData] = useState({
    title: '',
    category: 'TECHNICAL',
    status: 'PUBLISHED',
    content: '',
    keywords: '',
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialArticle) {
      setFormData({
        title: initialArticle.title || '',
        category: initialArticle.category || 'TECHNICAL',
        status: initialArticle.status || 'PUBLISHED',
        content: initialArticle.content || '',
        keywords: Array.isArray(initialArticle.keywords)
          ? initialArticle.keywords.join(', ')
          : initialArticle.keywords || '',
      });
    } else {
      setFormData({
        title: '',
        category: 'TECHNICAL',
        status: 'PUBLISHED',
        content: '',
        keywords: '',
      });
    }
  }, [initialArticle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      addToast('Article title is required', 'error');
      return;
    }
    if (!formData.content.trim()) {
      addToast('Article content cannot be empty', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        status: formData.status,
        content: formData.content.trim(),
        keywords: formData.keywords,
      };

      if (isEditing) {
        await updateArticle(initialArticle._id, payload);
        addToast('Knowledge article updated successfully!', 'success');
      } else {
        await createArticle(payload);
        addToast('Knowledge article created and saved!', 'success');
      }

      onSaved();
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to save knowledge article', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!window.confirm(`Are you sure you want to delete "${formData.title}"?`)) return;

    setDeleting(true);
    try {
      await deleteArticle(initialArticle._id);
      addToast('Knowledge article deleted.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to delete article', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isEditing ? 'Edit Knowledge Article' : 'Create Knowledge Article'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Update guidance, keywords, and publication status.'
                  : 'Add a new self-service troubleshooting article to ResolveIQ.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Article Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. How to Resolve UPI Transaction Delays"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Category & Status in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 font-medium bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Publication Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 font-medium bg-white"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Article Content & Troubleshooting Instructions *
            </label>
            <textarea
              required
              rows={6}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Provide clear, step-by-step guidance for customers to resolve their issue..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 leading-relaxed placeholder-slate-400"
            ></textarea>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Keywords / Search Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              placeholder="e.g. upi, payment, refund, bank, transaction, pending"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 font-mono placeholder-slate-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Keywords are used by ResolveIQ Intelligent Search and the Ticket Composer auto-suggest engine.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {isEditing ? (
              <button
                type="button"
                disabled={deleting || loading}
                onClick={handleDelete}
                className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                <span>{deleting ? 'Deleting...' : 'Delete Article'}</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Article'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

