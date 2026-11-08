/**
 * ResolveIQ API Base URL Configuration
 * 
 * Configures the backend API endpoint dynamically:
 * - In local dev (Vite proxy) or unified fullstack deployment: defaults to '/api'
 * - In distributed production (e.g. Render Static Site frontend + Render Web Service backend):
 *   reads VITE_API_URL from environment variables and normalizes trailing slashes.
 */

const getApiBase = () => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta?.env)
    ? import.meta.env.VITE_API_URL
    : (typeof process !== 'undefined' && process.env?.VITE_API_URL ? process.env.VITE_API_URL : null);
  if (!envUrl || envUrl.trim() === '' || envUrl.trim() === '/api') {
    return '/api';
  }
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const API_BASE = getApiBase();
export const AUTH_API_BASE = `${API_BASE}/auth`;

/**
 * Safe fetch wrapper with AbortController timeout to prevent indefinite pending requests.
 * Defaults to 15,000ms (15 seconds).
 */
export const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      throw new Error(`Connection timed out after ${Math.round(timeoutMs / 1000)}s. The backend server took too long to respond. If the service was sleeping from inactivity, please try again.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
