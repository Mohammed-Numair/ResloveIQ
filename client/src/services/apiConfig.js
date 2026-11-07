/**
 * ResolveIQ API Base URL Configuration
 * 
 * Configures the backend API endpoint dynamically:
 * - In local dev (Vite proxy) or unified fullstack deployment: defaults to '/api'
 * - In distributed production (e.g. Render Static Site frontend + Render Web Service backend):
 *   reads VITE_API_URL from environment variables and normalizes trailing slashes.
 */

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl.trim() === '' || envUrl.trim() === '/api') {
    return '/api';
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const API_BASE = getApiBase();
export const AUTH_API_BASE = `${API_BASE}/auth`;

