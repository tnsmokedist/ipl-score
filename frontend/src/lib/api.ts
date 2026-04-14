'use client';

const RENDER_URL = 'https://ipl-score-l2c8.onrender.com';

function getBaseUrl(): string {
  if (typeof window === 'undefined') return RENDER_URL; // SSR → use Render
  if (window.location.hostname === 'localhost') return 'http://localhost:5000';
  return RENDER_URL;
}

type FetchOptions = RequestInit & {
  requireAuth?: boolean;
};

export const api = {
  get: async (endpoint: string, options: FetchOptions = {}) => {
    return fetchWithAuth(`${getBaseUrl()}${endpoint}`, { ...options, method: 'GET' });
  },

  post: async (endpoint: string, body: any, options: FetchOptions = {}) => {
    return fetchWithAuth(`${getBaseUrl()}${endpoint}`, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  },
  
  put: async (endpoint: string, body: any, options: FetchOptions = {}) => {
    return fetchWithAuth(`${getBaseUrl()}${endpoint}`, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  },

  delete: async (endpoint: string, options: FetchOptions = {}) => {
    return fetchWithAuth(`${getBaseUrl()}${endpoint}`, { ...options, method: 'DELETE' });
  },
};

async function fetchWithAuth(url: string, options: FetchOptions) {
  const headers = new Headers(options.headers || {});
  
  const requireAuth = options.requireAuth ?? true;

  if (requireAuth) {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred with the API request');
  }

  return data;
}

