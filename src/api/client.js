/**
 * Voter API Client Configuration
 * 
 * This axios instance handles all voter-facing API calls with:
 * - Automatic x-api-key header (voter authentication)
 * - Automatic x-terminal-id header (audit trail)
 * - Automatic JWT Bearer token (session authentication)
 * - Base URL from environment variables
 */

import axios from 'axios';

// Get API keys from environment variables (best practice)
// Fallback to hardcoded keys ONLY for local development
const VOTER_API_KEY = import.meta.env.VITE_VOTER_API_KEY || 'voter-secret-key-456';
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';
export const TERMINAL_ID = import.meta.env.VITE_TERMINAL_ID || 'TERM-WEB-001';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': VOTER_API_KEY,        // Required by apiKeyAuth middleware
    'x-terminal-id': TERMINAL_ID,      // Required by trackTerminal middleware
  },
});

/**
 * Request Interceptor: Automatically add JWT token if available
 * 
 * Flow:
 * 1. User logs in → receives JWT from /ec/create-session
 * 2. JWT stored in sessionStorage
 * 3. This interceptor adds it to EVERY request automatically
 * 4. Backend verifies JWT for protected routes (/ec/*, /votes)
 * 
 * Security: JWT expires after 10 minutes (backend enforced)
 */
apiClient.interceptors.request.use(
  (config) => {
    // Check if JWT token exists in session storage
    const authToken = sessionStorage.getItem('authToken');
    
    // HNDL & Privacy: Do NOT send the Authorization header on the /votes/submit path.
    // This ensures that the voter's identity JWT is completely omitted from the anonymous vote submission.
    if (authToken && !config.url.endsWith('/votes/submit')) {
      // Add Authorization header with Bearer token
      config.headers['Authorization'] = `Bearer ${authToken}`;
      
      // Debug log (remove in production)
      console.log('🔑 JWT Token attached to request:', config.url);
    }
    
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: Handle common errors globally
 * 
 * Common errors:
 * - 401 Unauthorized: JWT expired or invalid → redirect to login
 * - 403 Forbidden: API key invalid or terminal not allowed
 * - 500 Server Error: Backend issue → show friendly message
 */
apiClient.interceptors.response.use(
  (response) => {
    // Notify connectivity listeners that backend is online
    window.dispatchEvent(new CustomEvent('backend-online'));
    return response;
  },
  (error) => {
    if (error.response) {
      // Backend responded, so server is up
      window.dispatchEvent(new CustomEvent('backend-online'));
      const status = error.response.status;
      
      if (status === 401) {
        // JWT expired or invalid
        console.error('🚨 Authentication failed - Session expired');
        
        // Clear expired token
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('sessionID');
      } else if (status === 403) {
        // API key or terminal issue
        console.error('🚨 Access forbidden - Check API key and terminal ID');
      } else if (status === 500) {
        // Server error
        console.error('🚨 Server error:', error.response.data.message);
      }
    } else if (error.request) {
      // Request made but no response (network error / server down)
      console.error('🚨 Network error - Cannot reach backend');
      console.error('Backend URL:', API_BASE_URL);
      window.dispatchEvent(new CustomEvent('backend-offline'));
    } else {
      // Something else happened
      console.error('🚨 Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
