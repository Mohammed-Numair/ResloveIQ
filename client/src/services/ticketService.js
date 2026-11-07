/**
 * Ticket, User Management & Knowledge Base API Service
 */

const API_BASE = '/api';

const authHeaders = () => {
  const token = localStorage.getItem('resolveiq_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Fetch tickets with optional query filters
 */
export const getTickets = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key]) params.append(key, filters[key]);
  });

  const res = await fetch(`${API_BASE}/tickets?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch tickets');
  return data;
};

/**
 * Fetch ticket by ID
 */
export const getTicketById = async (id) => {
  const res = await fetch(`${API_BASE}/tickets/${id}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch ticket details');
  return data;
};

/**
 * Submit a new ticket
 */
export const createTicket = async (ticketData) => {
  const res = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(ticketData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create ticket');
  return data;
};

/**
 * Update ticket status (Staff)
 */
export const updateTicketStatus = async (id, status) => {
  const res = await fetch(`${API_BASE}/tickets/${id}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update ticket status');
  return data;
};

/**
 * Assign ticket to agent
 */
export const assignTicket = async (id, agentId) => {
  const res = await fetch(`${API_BASE}/tickets/${id}/assign`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ agentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to assign ticket');
  return data;
};

/**
 * Add a public reply or internal private note
 */
export const addTicketMessage = async (id, message, isInternal = false, attachments = []) => {
  const res = await fetch(`${API_BASE}/tickets/${id}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, isInternal, attachments }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to post message');
  return data;
};

/**
 * Submit Customer Satisfaction (CSAT) Rating
 */
export const rateTicket = async (id, score, comment = '') => {
  const res = await fetch(`${API_BASE}/tickets/${id}/rate`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ score, comment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to submit satisfaction rating');
  return data;
};

/**
 * Reopen a resolved ticket
 */
export const reopenTicket = async (id, reason = '') => {
  const res = await fetch(`${API_BASE}/tickets/${id}/reopen`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to reopen ticket');
  return data;
};

/**
 * Escalate a ticket
 */
export const escalateTicket = async (id, reason = '') => {
  const res = await fetch(`${API_BASE}/tickets/${id}/escalate`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to escalate ticket');
  return data;
};

/**
 * Lookup ticket by 6-digit Call PIN (Voice IVR Phone Telephony Simulation)
 */
export const lookupTicketByCallPin = async (pin) => {
  const res = await fetch(`${API_BASE}/tickets/lookup/pin/${encodeURIComponent(pin)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Ticket not found for Call PIN');
  return data;
};

/**
 * Send active viewer presence heartbeat
 */
export const sendViewerHeartbeat = async (id) => {
  const res = await fetch(`${API_BASE}/tickets/${id}/viewing`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) return { activeViewers: [] };
  return data;
};

/**
 * Fetch Categories with Guided Troubleshooting & Policy definitions
 */
export const getCategories = async () => {
  const res = await fetch(`${API_BASE}/categories`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch categories');
  return data;
};

/**
 * Fetch Manager/Admin Analytics
 */
export const getTicketAnalytics = async () => {
  const res = await fetch(`${API_BASE}/tickets/analytics/overview`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load analytics');
  return data;
};

/**
 * Download CSV Export
 */
export const downloadTicketsCSV = async () => {
  const res = await fetch(`${API_BASE}/tickets/export/csv`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to generate CSV export');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resolveiq-tickets-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Get all support agents for assignment dropdowns
 */
export const getSupportAgents = async () => {
  const res = await fetch(`${API_BASE}/users/agents`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load support agents');
  return data;
};

/**
 * Get all users (Admin/Manager)
 */
export const getAllUsers = async () => {
  const res = await fetch(`${API_BASE}/users`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load user list');
  return data;
};

/**
 * Create Staff User (Admin)
 */
export const createStaffUser = async (userData) => {
  const res = await fetch(`${API_BASE}/users/staff`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create staff account');
  return data;
};

/**
 * Update user role (Admin)
 */
export const updateUserRole = async (userId, role) => {
  const res = await fetch(`${API_BASE}/users/${userId}/role`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update user role');
  return data;
};

/**
 * Fetch Knowledge Base Articles with search, category and status filters
 */
export const getArticles = async (filters = {}) => {
  const params = new URLSearchParams();
  if (typeof filters === 'string') {
    if (filters && filters !== 'ALL') params.append('category', filters);
  } else if (filters && typeof filters === 'object') {
    if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/articles${queryString}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch knowledge base');
  return data;
};

/**
 * Fetch a single Knowledge Base Article by ID (increments view count, fetches related articles)
 */
export const getArticleById = async (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('Article ID is required');
  const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(cleanId)}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch article details');
  return data;
};

/**
 * Submit helpful / not helpful feedback for an article
 */
export const submitArticleFeedback = async (id, helpful) => {
  const cleanId = String(id || '').replace(/^\/+|\/+$/g, '').trim();
  if (!cleanId) throw new Error('Article ID is required');

  const payload = { helpful: Boolean(helpful), articleId: cleanId };
  const headers = authHeaders();

  let res = await fetch(`${API_BASE}/articles/${encodeURIComponent(cleanId)}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // Resilient fallback if primary route returns 404 (e.g. proxy or route caching)
  if (res.status === 404) {
    res = await fetch(`${API_BASE}/articles/feedback/${encodeURIComponent(cleanId)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (res.status === 404) {
    res = await fetch(`${API_BASE}/articles/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to submit article feedback');
  return data;
};

/**
 * Create a new Knowledge Base Article (Support Manager & Admin)
 */
export const createArticle = async (articleData) => {
  const res = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(articleData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create article');
  return data;
};

/**
 * Update an existing Knowledge Base Article (Support Manager & Admin)
 */
export const updateArticle = async (id, articleData) => {
  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('Article ID is required');
  const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(cleanId)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(articleData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update article');
  return data;
};

/**
 * Delete a Knowledge Base Article (Support Manager & Admin)
 */
export const deleteArticle = async (id) => {
  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('Article ID is required');
  const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(cleanId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete article');
  return data;
};

/**
 * Get Suggested Articles for live ticket creation
 */
export const getSuggestedArticles = async (queryText) => {
  if (!queryText || queryText.length < 3) return { suggestions: [] };
  const res = await fetch(`${API_BASE}/articles/suggestions?q=${encodeURIComponent(queryText)}`);
  const data = await res.json();
  if (!res.ok) return { suggestions: [] };
  return data;
};
