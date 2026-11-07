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
export const addTicketMessage = async (id, message, isInternal = false) => {
  const res = await fetch(`${API_BASE}/tickets/${id}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, isInternal }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to post message');
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
 * Fetch Knowledge Base Articles
 */
export const getArticles = async (category = '') => {
  const url = category ? `${API_BASE}/articles?category=${category}` : `${API_BASE}/articles`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch knowledge base');
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

