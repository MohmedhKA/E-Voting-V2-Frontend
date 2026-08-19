/**
 * Testing API Client for Performance Testing
 * Separate from main apiClient to avoid auth conflicts
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const testingClient = axios.create({
  baseURL: `${API_BASE_URL}/testing`,
  timeout: 600000, // 10 minutes for long-running simulations
  headers: {
    'Content-Type': 'application/json',
    'x-testing-key': import.meta.env.VITE_TESTING_SECRET_KEY || 'evoting-sim-2026',
  },
});

export default testingClient;
