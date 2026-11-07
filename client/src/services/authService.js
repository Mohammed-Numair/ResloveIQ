/**
 * Authentication API Service
 * Communicates with ResolveIQ Express backend
 */

import { AUTH_API_BASE } from './apiConfig.js';

const NETWORK_ERROR_MSG = 'Unable to reach the ResolveIQ backend server. Please verify network connectivity and that the backend service is online.';

/**
 * Register a new user
 * @param {Object} userData - { name, email, password, role }
 */
export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${AUTH_API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned unexpected status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed. Please try again.');
    }

    return data;
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(NETWORK_ERROR_MSG);
    }
    throw error;
  }
};

/**
 * Log in an existing user
 * @param {Object} credentials - { email, password }
 */
export const loginUser = async (credentials) => {
  try {
    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned unexpected status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data.message || 'Login failed. Please check your credentials.');
    }

    return data;
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(NETWORK_ERROR_MSG);
    }
    throw error;
  }
};

/**
 * Fetch current authenticated user profile
 * @param {string} token - JWT authentication token
 */
export const getProfile = async (token) => {
  try {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server returned unexpected status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to authenticate session.');
    }

    return data;
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(NETWORK_ERROR_MSG);
    }
    throw error;
  }
};
