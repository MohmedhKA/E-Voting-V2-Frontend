import axios from 'axios';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'admin-secret-key-123';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const adminClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_API_KEY,
  },
});

export default adminClient;
