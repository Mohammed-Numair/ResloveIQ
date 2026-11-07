import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRoleBadge } from '../components/Navbar';
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  assignTicket,
  addTicketMessage,
  getTicketAnalytics,
  downloadTicketsCSV,
  getSupportAgents,
  getAllUsers,
  createStaffUser,
  updateUserRole,
  getSuggestedArticles,
  getArticles,
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
  ExternalLink,
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
  const isCustomer = user?.role === 'CUSTOMER';
  const isAgent = user?.role === 'SUPPORT_AGENT';
  const isManager = user?.role === 'SUPPORT_MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = isAgent || isManager || isAdmin;

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'analytics' | 'users' | 'knowledge'

  // Ticket Data State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [myQueueOnly, setMyQueueOnly] = useState(false);

  // Selected Ticket for Details Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Message Sending State
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Create Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
  });
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [suggestedArticles, setSuggestedArticles] = useState([]);

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
  const [staffSuccess, setStaffSuccess] = useState(null);

  // Initial Data Load
  const fetchTicketsData = async () => {
    setLoading(true);
    setError(null);
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
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsData();
  }, [statusFilter, priorityFilter, categoryFilter, searchTerm, myQueueOnly]);

  // Load secondary data when switching tabs
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

  // Open Ticket Detail Modal
  const handleOpenTicket = async (id) => {
    setLoadingDetails(true);
    try {
      const data = await getTicketById(id);
      setSelectedTicket(data.ticket);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Submit New Ticket
  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      alert('Please fill in both title and description');
      return;
    }
    setCreatingTicket(true);
    try {
      await createTicket(newTicket);
      setShowCreateModal(false);
      setNewTicket({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
      setSuggestedArticles([]);
      fetchTicketsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingTicket(false);
    }
  };

  // Title change with live self-service article suggestions
  const handleTitleChange = async (e) => {
    const val = e.target.value;
    setNewTicket({ ...newTicket, title: val });
    if (val.length >= 3) {
      const res = await getSuggestedArticles(val);
      setSuggestedArticles(res.suggestions || []);
    } else {
      setSuggestedArticles([]);
    }
  };

  // Status Update
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const res = await updateTicketStatus(selectedTicket._id, newStatus);
      setSelectedTicket(res.ticket);
      fetchTicketsData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Assign Ticket
  const handleAssignChange = async (agentId) => {
    if (!selectedTicket) return;
    try {
      const res = await assignTicket(selectedTicket._id, agentId);
      setSelectedTicket(res.ticket);
      fetchTicketsData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Send Message / Note
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await addTicketMessage(selectedTicket._id, replyText, isInternalNote);
      setSelectedTicket(res.ticket);
      setReplyText('');
      fetchTicketsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Insert AI Reply
  const handleInsertAIReply = () => {
    if (selectedTicket?.aiMetadata?.suggestedReply) {
      setReplyText(selectedTicket.aiMetadata.suggestedReply);
      setIsInternalNote(false);
    }
  };

  // Admin: Create Staff Submit
  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      await createStaffUser(newStaff);
      setStaffSuccess(`Created staff account for ${newStaff.name}`);
      setNewStaff({ name: '', email: '', password: '', role: 'SUPPORT_AGENT' });
      getAllUsers().then((d) => setUsersList(d.users || []));
      setTimeout(() => setStaffSuccess(null), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  // Admin: Update User Role
  const handleRoleUpdate = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      getAllUsers().then((d) => setUsersList(d.users || []));
    } catch (err) {
      alert(err.message);
    }
  };

  const badge = user ? getRoleBadge(user.role) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <div className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-sm ${badge?.bg}`}>
              {badge?.icon}
              {badge?.label} Portal
            </div>
            <span className="text-xs text-indigo-300">&bull; Live MongoDB Atlas Database</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1">
            {isCustomer && 'Create support tickets, track resolutions, and chat with support agents in real time.'}
            {isAgent && 'Review assigned queues, claim open tickets, and respond with AI-assisted answers.'}
            {isManager && 'Monitor SLA deadlines, balance agent workload, review analytics, and export ticket data.'}
            {isAdmin && 'System Administration: Manage tickets, users, staff provisioning, and platform health.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isCustomer && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Submit New Ticket</span>
            </button>
          )}

          {(isManager || isAdmin) && (
            <button
              onClick={downloadTicketsCSV}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
              title="Export all tickets to CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-colors ${
            activeTab === 'tickets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isCustomer ? 'My Support Tickets' : 'Ticket Queue'}</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tickets' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {tickets.length}
          </span>
        </button>

        {(isManager || isAdmin) && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-colors ${
              activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Helpdesk Analytics</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-colors ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-colors ${
            activeTab === 'knowledge' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Knowledge Base (FAQs)</span>
        </button>
      </div>

      {/* TAB 1: TICKETS VIEW */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Quick Filter Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ticket ID, title, keywords..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent (4h SLA)</option>
                <option value="HIGH">High (12h SLA)</option>
                <option value="MEDIUM">Medium (24h SLA)</option>
                <option value="LOW">Low (48h SLA)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700"
              >
                <option value="">All Categories</option>
                <option value="TECHNICAL">Technical</option>
                <option value="BILLING">Billing</option>
                <option value="ACCOUNT">Account</option>
                <option value="GENERAL">General</option>
              </select>

              {isAgent && (
                <button
                  onClick={() => setMyQueueOnly(!myQueueOnly)}
                  className={`px-3 py-2 rounded-xl border transition-colors ${
                    myQueueOnly ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  My Queue
                </button>
              )}

              {(statusFilter || priorityFilter || categoryFilter || searchTerm || myQueueOnly) && (
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setPriorityFilter('');
                    setCategoryFilter('');
                    setSearchTerm('');
                    setMyQueueOnly(false);
                  }}
                  className="text-slate-400 hover:text-rose-600 text-xs px-2 py-1"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-indigo-600 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading tickets from database...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl text-xs text-center">
              {error}
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Tickets Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isCustomer
                  ? 'You have not submitted any tickets yet. Click "Submit New Ticket" to create your first inquiry!'
                  : 'No tickets matched your filter criteria.'}
              </p>
              {isCustomer && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Ticket</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Ticket ID</th>
                      <th className="py-3 px-4">Title & Details</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Priority & SLA</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">{isCustomer ? 'Assigned Agent' : 'Customer'}</th>
                      <th className="py-3 px-4">Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                          {t.ticketId || t._id.slice(-6)}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{t.description}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${PRIORITY_COLORS[t.priority]}`}>
                              {t.priority}
                            </span>
                            {t.isSlaBreached && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                              <span className="inline-flex items-center text-[10px] text-rose-600 font-bold">
                                <AlertTriangle className="w-3 h-3 mr-0.5" /> SLA Breached
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[t.status]}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isCustomer ? (
                            <span className="text-slate-600">
                              {t.assignedTo ? t.assignedTo.name : <em className="text-slate-400">Unassigned</em>}
                            </span>
                          ) : (
                            <span className="text-slate-800 font-medium">
                              {t.customer ? t.customer.name : 'Unknown'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1 text-slate-500 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.messages ? t.messages.length : 0}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenTicket(t._id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANAGER / ADMIN ANALYTICS */}
      {activeTab === 'analytics' && (isManager || isAdmin) && (
        <div className="space-y-6">
          {!analytics ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-indigo-600 mb-2" />
              <p className="text-xs text-slate-500">Calculating real-time analytics from MongoDB Atlas...</p>
            </div>
          ) : (
            <>
              {/* Analytics Top Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-slate-400">Total Tickets</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{analytics.summary.total}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-emerald-600">Open Tickets</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{analytics.summary.open}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-amber-600">In Progress</div>
                  <div className="text-2xl font-black text-amber-600 mt-1">{analytics.summary.inProgress}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-blue-600">Resolved</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{analytics.summary.resolved}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-rose-600">SLA Breached</div>
                  <div className="text-2xl font-black text-rose-600 mt-1">{analytics.summary.slaBreached}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-medium text-indigo-600">Resolution Rate</div>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{analytics.summary.resolutionRate}%</div>
                </div>
              </div>

              {/* Distribution Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Categories */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                    Category Breakdown
                  </h3>
                  <div className="space-y-2">
                    {analytics.categories.map((c) => (
                      <div key={c._id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{c._id || 'GENERAL'}</span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                    Priority Breakdown
                  </h3>
                  <div className="space-y-2">
                    {analytics.priorities.map((p) => (
                      <div key={p._id} className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${PRIORITY_COLORS[p._id] || 'bg-slate-100 text-slate-700'}`}>
                          {p._id}
                        </span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sentiment */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                    AI Customer Sentiment
                  </h3>
                  <div className="space-y-2">
                    {analytics.sentiments.map((s) => (
                      <div key={s._id} className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${SENTIMENT_COLORS[s._id] || 'bg-slate-100 text-slate-700'}`}>
                          {s._id || 'NEUTRAL'}
                        </span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Agent Workload Table */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  Support Agent Workload (Active Assigned Tickets)
                </h3>
                {analytics.agentWorkload.length === 0 ? (
                  <p className="text-xs text-slate-400">No agents currently assigned to active tickets.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Agent Name</th>
                          <th className="py-2.5 px-4">Email</th>
                          <th className="py-2.5 px-4">Role</th>
                          <th className="py-2.5 px-4 text-right">Active Tickets</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.agentWorkload.map((a) => (
                          <tr key={a._id}>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{a.name}</td>
                            <td className="py-2.5 px-4 text-slate-500">{a.email}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold border border-teal-200">
                                {a.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-indigo-600">{a.activeTickets}</td>
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

      {/* TAB 3: ADMIN USER MANAGEMENT */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Management & Role Provisioning</h2>
              <p className="text-xs text-slate-500">Security Rule: Only Admins can provision Staff & Manager roles.</p>
            </div>
            <button
              onClick={() => setShowStaffModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Staff Member</span>
            </button>
          </div>

          {staffSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{staffSuccess}</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4 text-right">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u._id}>
                      <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadge(u.role).bg}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(u.createdAt).toISOString().split('T')[0]}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleUpdate(u._id, e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
                        >
                          <option value="CUSTOMER">Customer</option>
                          <option value="SUPPORT_AGENT">Support Agent</option>
                          <option value="SUPPORT_MANAGER">Support Manager</option>
                          <option value="ADMIN">System Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Self-Service Knowledge Base & FAQs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Browse common troubleshooting solutions, billing guides, and helpdesk policies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articlesList.map((art) => (
              <div key={art._id || art.title} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {art.category}
                  </span>
                  <span className="text-[11px] text-slate-400">Helpful FAQ</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{art.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{art.content}</p>
                <div className="pt-2 flex flex-wrap gap-1">
                  {art.keywords && art.keywords.map((k) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {selectedTicket.ticketId}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[selectedTicket.status]}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-1">{selectedTicket.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted by <strong className="text-slate-700">{selectedTicket.customer?.name}</strong> &bull; {new Date(selectedTicket.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Description Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Description</div>
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* Staff Controls (Status & Assignment) */}
              {isStaff && (
                <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Update Ticket Status</label>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Support Agent</label>
                    {isAgent ? (
                      <button
                        onClick={() => handleAssignChange(user._id)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        {selectedTicket.assignedTo?._id === user._id ? 'Assigned to You' : 'Claim This Ticket'}
                      </button>
                    ) : (
                      <select
                        value={selectedTicket.assignedTo?._id || ''}
                        onChange={(e) => handleAssignChange(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
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
              )}

              {/* AI Metadata Card (Phase 5) */}
              {selectedTicket.aiMetadata && (
                <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-2">
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
                      <span className="text-slate-500">Detected Sentiment:</span>{' '}
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${SENTIMENT_COLORS[selectedTicket.aiMetadata.sentiment] || 'bg-slate-100'}`}>
                        {selectedTicket.aiMetadata.sentiment}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">SLA Target:</span>{' '}
                      <span className="font-semibold text-slate-800">{selectedTicket.slaHours} hours</span>
                    </div>
                  </div>

                  {selectedTicket.aiMetadata.summary && (
                    <div className="text-[11px] text-purple-900 bg-white/80 p-2 rounded-lg border border-purple-100">
                      <strong>Executive Summary:</strong> {selectedTicket.aiMetadata.summary}
                    </div>
                  )}

                  {isStaff && selectedTicket.aiMetadata.suggestedReply && (
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">AI Suggested First Response Available</span>
                      <button
                        onClick={handleInsertAIReply}
                        className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[10px]"
                      >
                        Insert Suggested Reply
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Conversation Messages */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Conversation History ({selectedTicket.messages?.length || 0})</span>
                </div>

                {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No messages yet. Send a reply below.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedTicket.messages.map((m) => (
                      <div
                        key={m._id}
                        className={`p-3.5 rounded-xl border ${
                          m.isInternal
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 text-[11px]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-900">{m.senderName}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${getRoleBadge(m.senderRole).bg}`}>
                              {m.senderRole}
                            </span>
                            {m.isInternal && (
                              <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-bold">
                                <Lock className="w-3 h-3 mr-0.5" /> Staff Internal Note
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[10px]">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-slate-800 whitespace-pre-wrap">{m.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendMessage} className="space-y-2 pt-2 border-t border-slate-200">
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
                        <Lock className="w-3 h-3 mr-1" /> Private Internal Note (Visible to staff only)
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
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:ring-1 ${
                    isInternalNote ? 'border-amber-300 bg-amber-50/30 focus:ring-amber-500' : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className={`inline-flex items-center space-x-1.5 px-4 py-2 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 ${
                      isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingReply ? 'Sending...' : isInternalNote ? 'Post Internal Note' : 'Send Public Reply'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>Submit Support Ticket</span>
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ticket Subject / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTicket.title}
                  onChange={handleTitleChange}
                  placeholder="e.g. Cannot process credit card invoice on checkout"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Self-service Knowledge Base live suggestions */}
              {suggestedArticles.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5">
                  <div className="font-bold text-indigo-900 flex items-center space-x-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Instant Self-Service Help (Did you mean?):</span>
                  </div>
                  {suggestedArticles.map((art) => (
                    <div key={art._id || art.title} className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-indigo-100">
                      <strong className="text-indigo-800">{art.title}:</strong> {art.content.slice(0, 110)}...
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="GENERAL">General</option>
                    <option value="TECHNICAL">Technical Support</option>
                    <option value="BILLING">Billing & Payments</option>
                    <option value="ACCOUNT">Account Security</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="LOW">Low (48h SLA)</option>
                    <option value="MEDIUM">Medium (24h SLA)</option>
                    <option value="HIGH">High (12h SLA)</option>
                    <option value="URGENT">Urgent (4h SLA)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Explain what happened, error codes observed, or what you need help with..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {creatingTicket ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN CREATE STAFF MEMBER */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <span>Provision New Staff Member</span>
              </h2>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="sarah@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="SUPPORT_AGENT">Support Agent</option>
                  <option value="SUPPORT_MANAGER">Support Manager</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm"
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
