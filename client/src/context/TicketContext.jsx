import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as ticketService from '../services/ticketService.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const TicketContext = createContext(null);

export const TicketProvider = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [activeViewers, setActiveViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    search: '',
    myQueue: false,
  });

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      search: '',
      myQueue: false,
    });
  };

  // Fetch tickets based on active filters
  const fetchTickets = useCallback(
    async (showLoading = true) => {
      if (!user) return;
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const queryParams = { ...filters };
        if (!queryParams.status) delete queryParams.status;
        if (!queryParams.priority) delete queryParams.priority;
        if (!queryParams.category) delete queryParams.category;
        if (!queryParams.search) delete queryParams.search;
        if (!queryParams.myQueue) delete queryParams.myQueue;

        const data = await ticketService.getTickets(queryParams);
        setTickets(data.tickets || []);
      } catch (err) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [user, filters, toast]
  );

  // Reload when user or filters change
  useEffect(() => {
    if (user) {
      fetchTickets();
    } else {
      setTickets([]);
      setCurrentTicket(null);
    }
  }, [user, filters, fetchTickets]);

  // Load single ticket details
  const loadTicketById = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const data = await ticketService.getTicketById(id);
      setCurrentTicket(data.ticket);
      return data.ticket;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Create ticket
  const createNewTicket = async (ticketData) => {
    setLoading(true);
    try {
      const data = await ticketService.createTicket(ticketData);
      toast.success(`Ticket ${data.ticket.ticketId} created successfully!`);
      await fetchTickets(false);
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update status
  const updateStatus = async (id, status) => {
    try {
      const data = await ticketService.updateTicketStatus(id, status);
      toast.success(`Ticket status updated to ${status}`);
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket(data.ticket);
      }
      setTickets((prev) => prev.map((t) => (t._id === id ? data.ticket : t)));
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Assign agent
  const assignTicketToAgent = async (id, agentId) => {
    try {
      const data = await ticketService.assignTicket(id, agentId);
      toast.success(data.message || 'Ticket assigned successfully');
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket(data.ticket);
      }
      setTickets((prev) => prev.map((t) => (t._id === id ? data.ticket : t)));
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Send message / internal note
  const sendMessage = async (id, message, isInternal = false, attachments = []) => {
    try {
      const data = await ticketService.addTicketMessage(id, message, isInternal, attachments);
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket(data.ticket);
      }
      setTickets((prev) => prev.map((t) => (t._id === id ? data.ticket : t)));
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Submit CSAT Rating
  const submitRating = async (id, score, comment) => {
    try {
      const data = await ticketService.rateTicket(id, score, comment);
      toast.success('Thank you for rating our support!');
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket((prev) => ({
          ...prev,
          satisfactionRating: data.satisfactionRating,
        }));
      }
      return data;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Reopen Ticket
  const reopenTicketAction = async (id, reason) => {
    try {
      const data = await ticketService.reopenTicket(id, reason);
      toast.success('Ticket reopened into active queue');
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket(data.ticket);
      }
      setTickets((prev) => prev.map((t) => (t._id === id ? data.ticket : t)));
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Escalate Ticket
  const escalateTicketAction = async (id, reason) => {
    try {
      const data = await ticketService.escalateTicket(id, reason);
      toast.warning('Ticket escalated to URGENT priority!');
      if (currentTicket && currentTicket._id === id) {
        setCurrentTicket(data.ticket);
      }
      setTickets((prev) => prev.map((t) => (t._id === id ? data.ticket : t)));
      return data.ticket;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Heartbeat for viewer presence collision
  useEffect(() => {
    if (!currentTicket?._id || !user) return;
    const interval = setInterval(async () => {
      try {
        const res = await ticketService.sendViewerHeartbeat(currentTicket._id);
        setActiveViewers(res.activeViewers || []);
      } catch {
        // ignore presence errors
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [currentTicket?._id, user]);

  return (
    <TicketContext.Provider
      value={{
        tickets,
        currentTicket,
        setCurrentTicket,
        activeViewers,
        loading,
        error,
        filters,
        setFilter,
        resetFilters,
        fetchTickets,
        loadTicketById,
        createNewTicket,
        updateStatus,
        assignTicketToAgent,
        sendMessage,
        submitRating,
        reopenTicketAction,
        escalateTicketAction,
      }}
    >
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};

export default TicketContext;

