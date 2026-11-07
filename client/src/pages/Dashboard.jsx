import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getRoleBadge } from '../components/Navbar';
import GuidedTroubleshooterModal from '../components/GuidedTroubleshooterModal';
import VoiceIvrModal from '../components/VoiceIvrModal';
import {
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addTicketMessage,
  rateTicket,
  reopenTicket,
  escalateTicket,
  getTicketAnalytics,
  downloadTicketsCSV,
  getSupportAgents,
  getAllUsers,
  createStaffUser,
  updateUserRole,
  getArticles,
  sendViewerHeartbeat,
} from '../services/ticketService';
import {
  Plus,
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Lock,
  Sparkles,
  Shield,
  User,
  Users,
  Send,
  Eye,
  RefreshCw,
  BookOpen,
  Headset,
  TrendingUp,
  FileText,
  X,
  Phone,
  Star,
  RotateCcw,
  Zap,
  Paperclip,
  CheckCircle,
} from 'lucide-react';

const PRIORITY_COLORS = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
};

const STATUS_COLORS = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_CUSTOMER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  RESOLVED: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const SENTIMENT_COLORS = {
  FRUSTRATED: 'bg-rose-100 text-rose-800 border-rose-300',
  URGENT: 'bg-amber-100 text-amber-800 border-amber-300',
  NEUTRAL: 'bg-slate-100 text-slate-700 border-slate-200',
  POSITIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const isCustomer = user?.role === 'CUSTOMER';
  const isAgent = user?.role === 'SUPPORT_AGENT';
  const isManager = user?.role === 'SUPPORT_MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = isAgent || isManager || isAdmin;

  // Tabs: 'tickets' | 'analytics' | 'users' | 'knowledge'
  const [activeTab, setActiveTab] = useState('tickets');

  // Ticket Data State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [myQueueOnly, setMyQueueOnly] = useState(false);

  // Selected Ticket for Details Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeViewers, setActiveViewers] = useState([]);

  // Message Sending State
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [sendingReply, setSendingReply] = useState(false);

  // CSAT Rating State
  const [csatRating, setCsatRating] = useState(5);
  const [csatComment, setCsatComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Reopen State
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [submittingReopen, setSubmittingReopen] = useState(false);

  // Modals
  const [showGuidedModal, setShowGuidedModal] = useState(false);
  const [showIvrModal, setShowIvrModal] = useState(false);
  const [dialPin, setDialPin] = useState('');

  // Analytics & Users State
  const [analytics, setAnalytics] = useState(null);
  const [agentsList, setAgentsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [articlesList, setArticlesList] = useState([]);

  // Create Staff Modal State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SUPPORT_AGENT',
  });

  // Fetch Tickets
  const fetchTicketsData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getTickets({
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        search: searchTerm,
        myQueue: myQueueOnly ? 'true' : '',
      });
      setTickets(data.tickets || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load tickets');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsData();
  }, [statusFilter, priorityFilter, categoryFilter, searchTerm, myQueueOnly]);

  // Load secondary data on tab switch
  useEffect(() => {
    if (isStaff) {
      getSupportAgents().then((d) => setAgentsList(d.agents || [])).catch(() => {});
    }
    if ((isManager || isAdmin) && activeTab === 'analytics') {
      getTicketAnalytics().then((d) => setAnalytics(d.analytics)).catch(() => {});
    }
    if (isAdmin && activeTab === 'users') {
      getAllUsers().then((d) => setUsersList(d.users || [])).catch(() => {});
    }
    if (activeTab === 'knowledge') {
      getArticles().then((d) => setArticlesList(d.articles || [])).catch(() => {});
    }
  }, [activeTab]);

  // Open Ticket Details Modal
  const handleOpenTicket = async (id) => {
    setActiveViewers([]);
    setLoadingDetails(true);
    setShowReopenInput(false);
    setReopenReason('');
    try {
      const data = await getTicketById(id);
      setSelectedTicket(data.ticket);
      // Trigger initial viewer presence
      const heartbeat = await sendViewerHeartbeat(id);
      if (isStaff) {
        setActiveViewers(heartbeat.activeViewers || []);
      } else {
        setActiveViewers([]);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Heartbeat polling for active viewers while ticket modal is open
  useEffect(() => {
    if (!selectedTicket?._id) return;
    const interval = setInterval(async () => {
      try {
        const res = await sendViewerHeartbeat(selectedTicket._id);
        if (isStaff) {
          setActiveViewers(res.activeViewers || []);
        } else {
          setActiveViewers([]);
        }
      } catch {
        // ignore presence heartbeat errors
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [selectedTicket?._id, isStaff]);

  // Update Status
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const res = await updateTicketStatus(selectedTicket._id, newStatus);
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t._id === res.ticket._id ? res.ticket : t)));
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Assign Ticket
  const handleAssignChange = async (agentId) => {
    if (!selectedTicket) return;
    try {
      const res = await assignTicket(selectedTicket._id, agentId);
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t._id === res.ticket._id ? res.ticket : t)));
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Escalate Ticket
  const handleEscalate = async () => {
    if (!selectedTicket) return;
    const reason = window.prompt('Please provide a reason for escalating to URGENT priority:');
    if (!reason) return;
    try {
      const res = await escalateTicket(selectedTicket._id, reason);
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t._id === res.ticket._id ? res.ticket : t)));
      toast.warning('Ticket escalated to URGENT priority!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Add Message or Internal Note
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const res = await addTicketMessage(
        selectedTicket._id,
        replyText.trim(),
        isInternalNote,
        replyAttachments
      );
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t._id === res.ticket._id ? res.ticket : t)));
      setReplyText('');
      setReplyAttachments([]);
      setIsInternalNote(false);
      toast.success(isInternalNote ? 'Internal note added' : 'Reply sent');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Insert AI suggested canned response
  const handleInsertAIReply = () => {
    if (selectedTicket?.aiMetadata?.suggestedReply) {
      setReplyText(selectedTicket.aiMetadata.suggestedReply);
      toast.info('AI suggested reply inserted into editor.');
    }
  };

  // Submit CSAT Rating
  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSubmittingRating(true);
    try {
      const res = await rateTicket(selectedTicket._id, csatRating, csatComment);
      setSelectedTicket((prev) => ({
        ...prev,
        satisfactionRating: res.satisfactionRating,
      }));
      toast.success('Thank you for rating our support!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  // Reopen Ticket
  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSubmittingReopen(true);
    try {
      const res = await reopenTicket(selectedTicket._id, reopenReason);
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t._id === res.ticket._id ? res.ticket : t)));
      setShowReopenInput(false);
      setReopenReason('');
      toast.success('Ticket reopened into active queue!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingReopen(false);
    }
  };

  // Launch Telephony IVR for a specific ticket Call PIN
  const handleDialTicketPin = (callPin) => {
    setDialPin(callPin);
    setShowIvrModal(true);
  };

  // Admin: Create Staff Account
  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      await createStaffUser(newStaff);
      toast.success(`Staff user ${newStaff.name} created!`);
      setShowStaffModal(false);
      setNewStaff({ name: '', email: '', password: '', role: 'SUPPORT_AGENT' });
      getAllUsers().then((d) => setUsersList(d.users || []));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Quick stats calculations
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  const breachedCount = tickets.filter((t) => t.isSlaBreached).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Welcome & Role Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Welcome back, {user?.name}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Live Atlas Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCustomer && 'Report issues, follow guided self-troubleshooting, or track active tickets.'}
            {isAgent && 'Triage customer inquiries, review AI insights, and manage resolution SLAs.'}
            {isManager && 'Monitor team workloads, track SLA compliance, and export performance reports.'}
            {isAdmin && 'Full administrative authority: manage platform users, settings, and analytics.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          {/* Telephony Simulator Trigger */}
          <button
            onClick={() => {
              setDialPin('');
              setShowIvrModal(true);
            }}
            className="flex-1 md:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer shadow-xs"
          >
            <Phone className="w-4 h-4 text-indigo-600" />
            <span>Voice IVR Telephony</span>
          </button>

          {isCustomer && (
            <button
              onClick={() => setShowGuidedModal(true)}
              className="flex-1 md:flex-none inline-flex items-center justify-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Issue / New Ticket</span>
            </button>
          )}

          {(isManager || isAdmin) && (
            <button
              onClick={downloadTicketsCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowStaffModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-2xl transition-colors cursor-pointer shadow-xs"
            >
              <Shield className="w-4 h-4" />
              <span>Provision Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Staff & Managers have Analytics/Users) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'tickets'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Support Tickets ({totalCount})
        </button>

        {(isManager || isAdmin) && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Real Analytics & Metrics
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            User Management & Roles
          </button>
        )}

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'knowledge'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Knowledge Base FAQs
        </button>
      </div>

      {/* TAB 1: TICKETS VIEW */}
      {activeTab === 'tickets' && (
        <div className="space-y-5">
          {/* Metric KPI Counter Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                Total
              </span>
              <span className="text-xl font-black text-slate-900">{totalCount}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-emerald-600 block tracking-wider">
                Open
              </span>
              <span className="text-xl font-black text-emerald-700">{openCount}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-amber-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-amber-600 block tracking-wider">
                In Progress
              </span>
              <span className="text-xl font-black text-amber-700">{inProgressCount}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-blue-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-blue-600 block tracking-wider">
                Resolved
              </span>
              <span className="text-xl font-black text-blue-700">{resolvedCount}</span>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-rose-100 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold uppercase text-rose-600 block tracking-wider">
                SLA Breached
              </span>
              <span className="text-xl font-black text-rose-700">{breachedCount}</span>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ticket ID, title, Call PIN, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="TECHNICAL">Technical Support</option>
              <option value="PAYMENTS_UPI">UPI & Payments</option>
              <option value="BILLING">Billing & Plans</option>
              <option value="ACCOUNT">Account Security</option>
              <option value="GENERAL">General Inquiries</option>
            </select>

            {/* Agent "My Queue" Toggle */}
            {isAgent && (
              <label className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl cursor-pointer text-indigo-700 font-bold select-none">
                <input
                  type="checkbox"
                  checked={myQueueOnly}
                  onChange={(e) => setMyQueueOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>My Queue Only</span>
              </label>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => fetchTicketsData()}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh Tickets"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Ticket Cards List */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading live tickets from MongoDB Atlas...</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Tickets Match Criteria</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No tickets found for your current filter query. Reset filters or report a new problem.
              </p>
              {isCustomer && (
                <button
                  onClick={() => setShowGuidedModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Report a Problem Now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {tickets.map((t) => {
                const isBreached = t.isSlaBreached;
                const isEscalated = t.escalated?.isEscalated;

                return (
                  <div
                    key={t._id}
                    onClick={() => handleOpenTicket(t._id)}
                    className="p-5 bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {t.ticketId}
                        </span>

                        {/* 6-Digit Telephony Call PIN Badge with Click-to-Dial */}
                        {t.callPin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDialTicketPin(t.callPin);
                            }}
                            className="inline-flex items-center space-x-1 font-mono text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                            title="Click to dial Call PIN in IVR Phone Simulator"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>PIN: {t.callPin}</span>
                          </button>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            STATUS_COLORS[t.status] || 'bg-slate-100'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            PRIORITY_COLORS[t.priority] || 'bg-slate-100'
                          }`}
                        >
                          {t.priority}
                        </span>

                        {isBreached && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center">
                            <Clock className="w-3 h-3 mr-0.5" /> SLA Breached
                          </span>
                        )}

                        {isEscalated && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 flex items-center">
                            <Zap className="w-3 h-3 mr-0.5 text-purple-600" /> Escalated
                          </span>
                        )}

                        {/* CSAT Star Badge if rated */}
                        {t.satisfactionRating?.score && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center">
                            <Star className="w-3 h-3 mr-0.5 text-amber-500 fill-amber-500" />
                            {t.satisfactionRating.score}/5 CSAT
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {t.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-1">{t.description}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>
                          Customer:{' '}
                          <strong className="text-slate-700 font-semibold">
                            {t.customer?.name || 'Customer'}
                          </strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Assigned:{' '}
                          <strong className="text-slate-700 font-semibold">
                            {t.assignedTo ? t.assignedTo.name : 'Unassigned'}
                          </strong>
                        </span>
                        <span>&bull;</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 flex-shrink-0 text-right">
                      <div className="text-[11px] text-slate-400">
                        {t.messages?.length || 0} messages
                      </div>
                      <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center">
                        View Details &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REAL MONGODB ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {!analytics ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading live MongoDB Atlas metrics...</div>
          ) : (
            <>
              {/* Analytics Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                    Total Inquiries
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {analytics.summary?.total || 0}
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-blue-100 shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-blue-600 block tracking-wider">
                    Resolution Rate
                  </span>
                  <span className="text-2xl font-black text-blue-700">
                    {analytics.summary?.resolutionRate || 0}%
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-amber-100 shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-amber-600 block tracking-wider">
                    Avg CSAT Rating
                  </span>
                  <span className="text-2xl font-black text-amber-700 flex items-center">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500 mr-1" />
                    {analytics.summary?.avgCsat || 0} / 5
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ({analytics.summary?.totalRatings || 0} customer reviews)
                  </span>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-rose-100 shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-rose-600 block tracking-wider">
                    Escalated Tickets
                  </span>
                  <span className="text-2xl font-black text-rose-700">
                    {analytics.summary?.escalated || 0}
                  </span>
                </div>
              </div>

              {/* Categorization & Priorities Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Categories Breakdown */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Volume by Issue Category
                  </h3>
                  <div className="space-y-2">
                    {analytics.categories?.map((c) => (
                      <div key={c._id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{c._id}</span>
                          <span>{c.count} tickets</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                ((c.count || 0) / (analytics.summary?.total || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sentiment Distribution */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Customer Sentiment Distribution (AI Triaged)
                  </h3>
                  <div className="space-y-2">
                    {analytics.sentiments?.map((s) => (
                      <div key={s._id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span className="capitalize">{s._id || 'Neutral'}</span>
                          <span>{s.count} tickets</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s._id === 'FRUSTRATED'
                                ? 'bg-rose-500'
                                : s._id === 'URGENT'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                ((s.count || 0) / (analytics.summary?.total || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Agent Workload Table */}
              <div className="p-5 bg-white rounded-3xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Active Agent Queue Workloads
                </h3>
                {analytics.agentWorkload?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No assigned active tickets in queue.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5">Agent Name</th>
                          <th className="py-2.5">Email</th>
                          <th className="py-2.5">Active Queue</th>
                          <th className="py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.agentWorkload?.map((aw) => (
                          <tr key={aw._id}>
                            <td className="py-2.5 font-bold text-slate-800">{aw.name}</td>
                            <td className="py-2.5 text-slate-500">{aw.email}</td>
                            <td className="py-2.5 font-bold text-indigo-700">
                              {aw.activeTickets} tickets
                            </td>
                            <td className="py-2.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT (ADMIN ONLY) */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Platform Accounts & Roles</h2>
            <button
              onClick={() => setShowStaffModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              + Create Staff Account
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Joined Date</th>
                  <th className="p-4">Role Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{u.name}</td>
                    <td className="p-4 text-slate-500">{u.email}</td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          getRoleBadge(u.role).bg
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      {u._id !== user._id && (
                        <select
                          value={u.role}
                          onChange={async (e) => {
                            try {
                              await updateUserRole(u._id, e.target.value);
                              toast.success(`Role updated for ${u.name}`);
                              getAllUsers().then((d) => setUsersList(d.users || []));
                            } catch (err) {
                              toast.error(err.message);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700"
                        >
                          <option value="CUSTOMER">Customer</option>
                          <option value="SUPPORT_AGENT">Support Agent</option>
                          <option value="SUPPORT_MANAGER">Support Manager</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: KNOWLEDGE BASE FAQS */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Self-Service Knowledge Base</h2>
              <p className="text-xs text-slate-500">
                Verified helpdesk articles and troubleshooting guides for self-service problem resolution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articlesList.map((art) => (
              <div
                key={art._id}
                className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {art.category}
                  </span>
                  <span className="text-[11px] text-slate-400">Knowledge Article</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{art.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{art.content}</p>
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {art.keywords?.map((k) => (
                    <span
                      key={k}
                      className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-mono"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: TICKET DETAIL & TIMELINE */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                    {selectedTicket.ticketId}
                  </span>

                  {/* Call PIN Badge with Click-to-Test Telephony */}
                  {selectedTicket.callPin && (
                    <button
                      type="button"
                      onClick={() => handleDialTicketPin(selectedTicket.callPin)}
                      className="inline-flex items-center space-x-1 font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                      title="Test Voice IVR telephony lookup"
                    >
                      <Phone className="w-3 h-3 text-indigo-600" />
                      <span>IVR Call PIN: {selectedTicket.callPin}</span>
                    </button>
                  )}

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      STATUS_COLORS[selectedTicket.status]
                    }`}
                  >
                    {selectedTicket.status.replace('_', ' ')}
                  </span>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      PRIORITY_COLORS[selectedTicket.priority]
                    }`}
                  >
                    {selectedTicket.priority}
                  </span>

                  {selectedTicket.isSlaBreached && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                      SLA Breached
                    </span>
                  )}
                </div>

                <h2 className="text-base font-bold text-slate-900 mt-1">{selectedTicket.title}</h2>
                <p className="text-xs text-slate-500">
                  Opened by <strong className="text-slate-700">{selectedTicket.customer?.name}</strong>{' '}
                  &bull; {new Date(selectedTicket.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setActiveViewers([]);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Staff Collision Alert Banner (Staff Only) */}
            {isStaff && activeViewers.length > 0 && (
              <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center space-x-2 border-b border-amber-600 shadow-xs animate-slide-in">
                <Eye className="w-4 h-4 flex-shrink-0" />
                <span>
                  Staff Collision Alert:{' '}
                  {activeViewers
                    .map((v) => `${v.userName} (${(v.userRole || 'STAFF').replace('_', ' ')})`)
                    .join(', ')}{' '}
                  is currently viewing this ticket.
                </span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Description Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reported Problem Description
                </span>
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>

                {/* Multimodal Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      📎 Attached Files & Screenshots:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:border-indigo-400 p-1.5 rounded-xl text-slate-700 transition-colors"
                        >
                          {att.fileType?.startsWith('image') ? (
                            <img src={att.url} alt="att" className="w-6 h-6 object-cover rounded" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="max-w-[120px] truncate text-[11px] font-medium">
                            {att.name}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Operations Bar (Status, Assign, Escalate) */}
              {isStaff && (
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Status Workflow
                      </label>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="PENDING_CUSTOMER">Pending Customer</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Assigned Agent
                      </label>
                      {isAgent ? (
                        <button
                          onClick={() => handleAssignChange(user._id)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          {selectedTicket.assignedTo?._id === user._id
                            ? 'Assigned to You (Click to refresh)'
                            : 'Claim This Ticket'}
                        </button>
                      ) : (
                        <select
                          value={selectedTicket.assignedTo?._id || ''}
                          onChange={(e) => handleAssignChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {agentsList.map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.name} ({a.role})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Escalation Control */}
                  {!selectedTicket.escalated?.isEscalated && (
                    <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">
                        Need specialized intervention or priority override?
                      </span>
                      <button
                        onClick={handleEscalate}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl flex items-center space-x-1 shadow-xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Escalate to URGENT</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AI Triage Card (Phase 5) */}
              {selectedTicket.aiMetadata && (
                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-xs font-bold text-purple-900">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Intelligent AI Triage Insights</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono">
                      {selectedTicket.aiMetadata.source}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Sentiment:</span>{' '}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          SENTIMENT_COLORS[selectedTicket.aiMetadata.sentiment] || 'bg-slate-100'
                        }`}
                      >
                        {selectedTicket.aiMetadata.sentiment}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">SLA Target:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedTicket.slaHours} hours
                      </span>
                    </div>
                  </div>

                  {selectedTicket.aiMetadata.summary && (
                    <div className="text-[11px] text-purple-900 bg-white/90 p-2.5 rounded-xl border border-purple-100">
                      <strong>Executive Summary:</strong> {selectedTicket.aiMetadata.summary}
                    </div>
                  )}

                  {isStaff && selectedTicket.aiMetadata.suggestedReply && (
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">Contextual canned reply available</span>
                      <button
                        onClick={handleInsertAIReply}
                        className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        Insert Canned Reply
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Customer CSAT Rating Box on Resolved Ticket */}
              {(selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED') && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center space-x-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>Customer Satisfaction (CSAT)</span>
                    </span>
                    {selectedTicket.satisfactionRating?.score && (
                      <span className="text-xs font-bold text-amber-800">
                        Rated {selectedTicket.satisfactionRating.score} / 5 Stars
                      </span>
                    )}
                  </div>

                  {selectedTicket.satisfactionRating?.score ? (
                    <p className="text-xs text-amber-900 italic">
                      "{selectedTicket.satisfactionRating.comment || 'Feedback recorded.'}"
                    </p>
                  ) : isCustomer ? (
                    <form onSubmit={handleRatingSubmit} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-600 font-medium">Your Rating:</span>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCsatRating(s)}
                            className="p-1 focus:outline-none cursor-pointer"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                s <= csatRating
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Optional comment about your experience..."
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-amber-200 bg-white"
                      />
                      <button
                        type="submit"
                        disabled={submittingRating}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        {submittingRating ? 'Saving...' : 'Submit Satisfaction Rating'}
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Pending customer feedback review.</p>
                  )}

                  {/* Reopen Ticket Option for Customer */}
                  {isCustomer && (
                    <div className="pt-2 border-t border-amber-200">
                      {showReopenInput ? (
                        <form onSubmit={handleReopenSubmit} className="space-y-2 mt-2">
                          <textarea
                            required
                            rows={2}
                            placeholder="Why do you need to reopen this ticket? Explain what still isn't working..."
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              type="submit"
                              disabled={submittingReopen}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                            >
                              {submittingReopen ? 'Reopening...' : 'Confirm Reopen'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowReopenInput(false)}
                              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowReopenInput(true)}
                          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Issue Persists? Click to Reopen Ticket</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation Messages */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Conversation Timeline ({selectedTicket.messages?.length || 0})</span>
                </div>

                {!selectedTicket.messages || selectedTicket.messages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No messages yet. Post a reply below.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedTicket.messages.map((m) => (
                      <div
                        key={m._id}
                        className={`p-3.5 rounded-2xl border ${
                          m.isInternal
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-[11px]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{m.senderName}</span>
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-semibold border ${
                                getRoleBadge(m.senderRole).bg
                              }`}
                            >
                              {m.senderRole}
                            </span>
                            {m.isInternal && (
                              <span className="inline-flex items-center text-[10px] px-2 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                                <Lock className="w-3 h-3 mr-0.5" /> Staff Internal Note
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {m.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendMessage} className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Write Response</label>
                  {isStaff && (
                    <label className="flex items-center space-x-1.5 text-xs text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="font-semibold flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> Private Internal Note (Staff Only)
                      </span>
                    </label>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'Type an internal note for support staff only...'
                      : 'Type your message to the customer/support team...'
                  }
                  className={`w-full p-3.5 rounded-2xl border text-xs focus:outline-none focus:ring-1 ${
                    isInternalNote
                      ? 'border-amber-300 bg-amber-50/30 focus:ring-amber-500'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className={`inline-flex items-center space-x-1.5 px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer ${
                      isInternalNote
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {sendingReply
                        ? 'Sending...'
                        : isInternalNote
                        ? 'Post Internal Note'
                        : 'Send Public Reply'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GUIDED TROUBLESHOOTER & TICKET CREATION (CUSTOMER) */}
      <GuidedTroubleshooterModal
        isOpen={showGuidedModal}
        onClose={() => setShowGuidedModal(false)}
        onTicketCreated={(created) => {
          fetchTicketsData();
          handleOpenTicket(created._id);
        }}
      />

      {/* MODAL 3: VOICE IVR TELEPHONY SIMULATOR */}
      <VoiceIvrModal
        isOpen={showIvrModal}
        onClose={() => setShowIvrModal(false)}
        defaultPin={dialPin}
      />

      {/* MODAL 4: ADMIN CREATE STAFF MEMBER */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <span>Provision New Staff Member</span>
              </h2>
              <button
                onClick={() => setShowStaffModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="Sarah Agent"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="sarah@resolveiq.test"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role Assignment</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold cursor-pointer"
                >
                  <option value="SUPPORT_AGENT">Support Agent</option>
                  <option value="SUPPORT_MANAGER">Support Manager</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
