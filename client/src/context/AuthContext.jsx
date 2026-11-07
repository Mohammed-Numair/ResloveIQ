import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getProfile } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('resolveiq_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('resolveiq_token') || null;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate session on initial load if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('resolveiq_token');
      if (storedToken) {
        try {
          const profileData = await getProfile(storedToken);
          setUser(profileData.user);
          localStorage.setItem('resolveiq_user', JSON.stringify(profileData.user));
        } catch (err) {
          console.warn('Session expired or invalid, logging out.');
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Register function
  const register = async (userData) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await registerUser(userData);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('resolveiq_token', data.token);
      localStorage.setItem('resolveiq_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err) {
      setError(err.message || 'Registration failed');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (credentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await loginUser(credentials);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('resolveiq_token', data.token);
      localStorage.setItem('resolveiq_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err) {
      setError(err.message || 'Login failed');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem('resolveiq_token');
    localStorage.removeItem('resolveiq_user');
  };

  // Clear error banner
  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom Hook to consume AuthContext cleanly
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

