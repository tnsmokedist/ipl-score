const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://ipl-score-l2c8.onrender.com' : 'http://localhost:5000');

type FetchOptions = RequestInit & {
  requireAuth?: boolean;
};

export const api = {
  get: async (endpoint: string, options: FetchOptions = {}) => {
    return fetchWithAuth(`${API_BASE_URL}${endpoint}`, { ...options, method: 'GET' });
  },

  post: async (endpoint: string, body: any, options: FetchOptions = {}) => {
    return fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
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
    return fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
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
    return fetchWithAuth(`${API_BASE_URL}${endpoint}`, { ...options, method: 'DELETE' });
  },
};

async function fetchWithAuth(url: string, options: FetchOptions) {
  const headers = new Headers(options.headers || {});
  
  // Conditionally attach token if required (defaults to true for protected routes)
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

  // Optional: Handle precise 401s globally (redirect to login)
  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred with the API request');
  }

  return data;
}
