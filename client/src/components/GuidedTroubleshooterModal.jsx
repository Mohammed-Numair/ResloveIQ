import React, { useState, useEffect } from 'react';
import {
  Wrench,
  ShieldAlert,
  HelpCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  X,
  FileText,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { getCategories, createTicket, getSuggestedArticles } from '../services/ticketService';
import { useToast } from '../context/ToastContext';

const GuidedTroubleshooterModal = ({ isOpen, onClose, onTicketCreated }) => {
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [stepIndex, setStepIndex] = useState(0); // For troubleshooting wizard
  const [stage, setStage] = useState('SELECT_CATEGORY'); // 'SELECT_CATEGORY' | 'TROUBLESHOOTING' | 'SUBMIT_FORM' | 'RESOLVED_SUCCESS'

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedFaqs, setSuggestedFaqs] = useState([]);

  // Fetch categories on mount
  useEffect(() => {
    if (isOpen) {
      getCategories()
        .then((res) => {
          setCategories(res.categories || []);
        })
        .catch((err) => {
          console.error('Failed to load categories:', err);
        });
    }
  }, [isOpen]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStage('SELECT_CATEGORY');
      setSelectedCategory(null);
      setStepIndex(0);
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setAttachments([]);
      setSuggestedFaqs([]);
    }
  }, [isOpen]);

  // Query live suggested FAQs as description is typed
  useEffect(() => {
    if (description.length > 5) {
      const timer = setTimeout(() => {
        getSuggestedArticles(description).then((res) => {
          setSuggestedFaqs(res.suggestions || []);
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestedFaqs([]);
    }
  }, [description]);

  if (!isOpen) return null;

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setPriority(cat.defaultPriority || 'MEDIUM');

    if (cat.troubleshootingSteps && cat.troubleshootingSteps.length > 0) {
      setStepIndex(0);
      setStage('TROUBLESHOOTING');
    } else {
      setStage('SUBMIT_FORM');
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        toast.warning('Attachment exceeds 2MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: event.target.result,
            fileType: file.type || 'image/png',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Please provide both title and description.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createTicket({
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory?.slug || 'GENERAL',
        priority,
        attachments,
      });

      toast.success(`Ticket ${res.ticket.ticketId} created with Call PIN: ${res.ticket.callPin}`);
      if (onTicketCreated) onTicketCreated(res.ticket);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">ResolveIQ Guided Support</h2>
              <p className="text-xs text-slate-500">Step-by-step problem resolution and smart ticket intake</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STAGE 1: CATEGORY SELECTION */}
          {stage === 'SELECT_CATEGORY' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">What do you need assistance with?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an issue category below to view guided self-help actions or connect with an agent.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {categories.map((cat) => {
                  const isRestricted = cat.policyType === 'RESTRICTED_CALL_REQUIRED';
                  const isDiy = cat.policyType === 'ALLOW_DIY';

                  return (
                    <button
                      key={cat.slug}
                      onClick={() => handleSelectCategory(cat)}
                      className="p-4 rounded-2xl border text-left transition-all hover:border-indigo-400 hover:shadow-md bg-white border-slate-200 group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {cat.name}
                          </span>
                          {isRestricted ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center">
                              <ShieldAlert className="w-3 h-3 mr-1 text-rose-500" />
                              Staff Only
                            </span>
                          ) : isDiy ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                              <Wrench className="w-3 h-3 mr-1 text-emerald-500" />
                              Self-Help
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              Assisted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{cat.description}</p>
                      </div>

                      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Target SLA: {cat.defaultSlaHours}h</span>
                        <span className="text-indigo-600 font-semibold flex items-center group-hover:translate-x-0.5 transition-transform">
                          Proceed &rarr;
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 2: GUIDED TROUBLESHOOTING FLOW */}
          {stage === 'TROUBLESHOOTING' && selectedCategory && (
            <div className="space-y-5">
              {/* Policy Banner for Financial / Sensitive transactions */}
              {selectedCategory.policyType === 'RESTRICTED_CALL_REQUIRED' && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Strict Security Policy Enforced</span>
                    Automated self-service refunds or credential alterations are restricted for financial safety. A verified support specialist will manage your case.
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>
                    Guided Troubleshooting: Step {stepIndex + 1} of{' '}
                    {selectedCategory.troubleshootingSteps.length}
                  </span>
                  <span className="text-indigo-600 font-bold">
                    {Math.round(
                      ((stepIndex + 1) / selectedCategory.troubleshootingSteps.length) * 100
                    )}
                    % Complete
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        ((stepIndex + 1) / selectedCategory.troubleshootingSteps.length) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Step Card */}
              {selectedCategory.troubleshootingSteps[stepIndex] && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      {selectedCategory.troubleshootingSteps[stepIndex].stepNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedCategory.troubleshootingSteps[stepIndex].title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-8">
                    {selectedCategory.troubleshootingSteps[stepIndex].instructions}
                  </p>
                </div>
              )}

              {/* Step Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStage('RESOLVED_SUCCESS')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>That Solved My Problem!</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setStepIndex((prev) => prev - 1)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl"
                    >
                      Back
                    </button>
                  )}

                  {stepIndex + 1 < selectedCategory.troubleshootingSteps.length ? (
                    <button
                      type="button"
                      onClick={() => setStepIndex((prev) => prev + 1)}
                      className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                    >
                      Next Step &rarr;
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setStage('SUBMIT_FORM')}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Still Broken &bull; Contact Agent
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: TICKET SUBMISSION FORM */}
          {stage === 'SUBMIT_FORM' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Category:</span>
                <span className="text-xs font-bold text-indigo-700">
                  {selectedCategory?.name || 'General Support'}
                </span>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Problem Summary / Title</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. UPI payment debited but order failed"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Detailed Description of the Issue
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please include error messages, transaction IDs, or steps leading up to the issue..."
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal text-slate-800"
                />
              </div>

              {/* Suggested FAQ match chips */}
              {suggestedFaqs.length > 0 && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                    💡 Related Knowledge Base Articles:
                  </span>
                  <div className="space-y-1">
                    {suggestedFaqs.map((faq) => (
                      <div
                        key={faq._id}
                        className="text-xs text-indigo-900 bg-white p-2 rounded-lg border border-indigo-100 flex items-center justify-between"
                      >
                        <span className="font-medium line-clamp-1">{faq.title}</span>
                        <span className="text-[10px] text-slate-400 ml-2">FAQ</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Urgency Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium"
                >
                  <option value="LOW">Low (General guidance &bull; 48h SLA)</option>
                  <option value="MEDIUM">Medium (Standard issue &bull; 24h SLA)</option>
                  <option value="HIGH">High (Impacts work &bull; 12h SLA)</option>
                  <option value="URGENT">Urgent (System down / Payment stuck &bull; 4h SLA)</option>
                </select>
              </div>

              {/* File Attachment Drag/Drop / Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  Screenshots or Error Logs (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition-colors relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.log,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-600 block">
                    Click or drag image screenshot / logs here
                  </span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, or TXT up to 2MB</span>
                </div>

                {/* Attachment Previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
                      >
                        {att.fileType.startsWith('image') ? (
                          <img src={att.url} alt="preview" className="w-4 h-4 object-cover rounded" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span className="max-w-[120px] truncate">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-slate-400 hover:text-rose-600 ml-1 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStage('SELECT_CATEGORY')}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  &larr; Choose Different Category
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {submitting ? 'Submitting to AI Engine...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          )}

          {/* STAGE 4: RESOLVED SUCCESS (TICKET DEFLECTION) */}
          {stage === 'RESOLVED_SUCCESS' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Glad We Could Help!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Your issue was successfully resolved via self-service troubleshooting. No ticket was created, saving you time.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuidedTroubleshooterModal;
