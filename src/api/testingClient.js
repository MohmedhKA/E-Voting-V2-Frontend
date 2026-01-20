/**
 * Testing API Client for Performance Testing
 * Separate from main apiClient to avoid auth conflicts
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'admin-secret-key-123';

const testingClient = axios.create({
  baseURL: `${API_BASE_URL}/testing`,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_API_KEY,
  },
  timeout: 600000, // 10 minutes for long-running simulations
});

export default testingClient;
