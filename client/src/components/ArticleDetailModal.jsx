import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  User,
  Tag,
  ArrowRight,
  BookOpen,
  Edit,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getArticleById, submitArticleFeedback } from '../services/ticketService';
import { useToast } from '../context/ToastContext';

export default function ArticleDetailModal({
  articleId,
  onClose,
  onSelectArticle,
  onEditArticle,
  canEdit = false,
}) {
  const { addToast } = useToast();
  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!articleId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setFeedbackSubmitted(false);

    getArticleById(articleId)
      .then((data) => {
        if (isMounted) {
          setArticle(data.article);
          setRelatedArticles(data.relatedArticles || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load article details');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [articleId]);

  const handleFeedback = async (isHelpful) => {
    if (feedbackSubmitted || submittingFeedback || !article) return;
    setSubmittingFeedback(true);

    try {
      const res = await submitArticleFeedback(article._id, isHelpful);
      setArticle((prev) => ({
        ...prev,
        helpfulCount: res.helpfulCount ?? (isHelpful ? (prev.helpfulCount || 0) + 1 : prev.helpfulCount),
        notHelpfulCount: res.notHelpfulCount ?? (!isHelpful ? (prev.notHelpfulCount || 0) + 1 : prev.notHelpfulCount),
      }));
      setFeedbackSubmitted(true);
      addToast('Thank you for rating this article!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to record feedback', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (!articleId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                <BookOpen className="w-3 h-3 text-indigo-600 mr-1" />
                {article?.category || 'Knowledge Base'}
              </span>

              {article?.status && article.status !== 'PUBLISHED' && (
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                    article.status === 'DRAFT'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {article.status}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">
              {loading ? 'Loading article...' : article?.title}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {canEdit && article && (
              <button
                type="button"
                onClick={() => onEditArticle && onEditArticle(article)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Edit Article"
              >
                <Edit className="w-4 h-4 text-indigo-600" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">Fetching verified article...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <>
              {/* Meta information row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Author: {article.authorName || 'ResolveIQ Ops'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Updated:{' '}
                    {new Date(article.updatedAt || article.createdAt || Date.now()).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>{article.viewCount || 1} views</span>
                </div>
                <div className="flex items-center space-x-1 text-emerald-600 font-medium">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{article.helpfulCount || 0} found this helpful</span>
                </div>
              </div>

              {/* Full Article Content */}
              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-800 whitespace-pre-wrap font-normal">
                {article.content}
              </div>

              {/* Tags / Keywords */}
              {article.keywords && article.keywords.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>Keywords & Related Tags:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {article.keywords.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono border border-slate-200"
                      >
                        #{k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Helpful / Not Helpful Feedback Widget */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Was this article helpful?</h4>
                  <p className="text-[11px] text-slate-500">
                    Your feedback helps us continuously improve ResolveIQ self-service troubleshooting.
                  </p>
                </div>

                {feedbackSubmitted ? (
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Feedback Recorded!</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={() => handleFeedback(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-medium text-slate-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Yes ({article.helpfulCount || 0})</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={() => handleFeedback(false)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium text-slate-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <ThumbsDown className="w-3.5 h-3.5 text-rose-500" />
                      <span>No ({article.notHelpfulCount || 0})</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Related Articles Section */}
              {relatedArticles.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Related Articles in {article.category}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {relatedArticles.map((rel) => (
                      <button
                        key={rel._id}
                        type="button"
                        onClick={() => onSelectArticle && onSelectArticle(rel._id)}
                        className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                            {rel.title}
                          </p>
                          <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-0.5">
                            <span>{rel.viewCount || 0} views</span>
                            <span>•</span>
                            <span>{rel.helpfulCount || 0} helpful</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Close Article
          </button>
        </div>
      </div>
    </div>
  );
}

