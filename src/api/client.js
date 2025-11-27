import axios from 'axios';

// Get API keys from environment variables (best practice)
// Fallback to our known keys for local development
const VOTER_API_KEY = import.meta.env.VITE_VOTER_API_KEY || 'voter-secret-key-456';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': VOTER_API_KEY,
  },
});

export default apiClient;
