// API Configuration and Utilities
// Replace with your actual backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Token management
export const tokenManager = {
  get: () => localStorage.getItem('auth_token'),
  set: (token: string) => localStorage.setItem('auth_token', token),
  remove: () => localStorage.removeItem('auth_token'),
};

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = tokenManager.get();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'An error occurred',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
}

// Authentication APIs
export const authApi = {
  register: async (userData: {
    fullName: string;
    email: string;
    password: string;
    walletAddress: string;
  }) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  login: async (credentials: { email: string; password: string }) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async () => {
    tokenManager.remove();
    return { success: true };
  },

  verifyToken: async () => {
    return apiRequest('/auth/verify');
  },
};

// Face Verification APIs
export const faceApi = {
  verify: async (imageData: string) => {
    return apiRequest('/face/verify', {
      method: 'POST',
      body: JSON.stringify({ image: imageData }),
    });
  },

  getStatus: async () => {
    return apiRequest('/face/status');
  },
};

// Loan APIs
export const loanApi = {
  create: async (loanData: {
    amount: number;
    duration: number;
    interestRate: number;
    purpose: string;
  }) => {
    return apiRequest('/loans/create', {
      method: 'POST',
      body: JSON.stringify(loanData),
    });
  },

  getAll: async (filters?: { status?: string; borrowerId?: string }) => {
    const queryParams = new URLSearchParams(filters as any).toString();
    return apiRequest(`/loans${queryParams ? `?${queryParams}` : ''}`);
  },

  getById: async (loanId: string) => {
    return apiRequest(`/loans/${loanId}`);
  },

  getBorrowerLoans: async (borrowerId: string) => {
    return apiRequest(`/loans/borrower/${borrowerId}`);
  },

  repay: async (loanId: string, amount: number) => {
    return apiRequest(`/loans/${loanId}/repay`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },
};

// Analytics APIs
export const analyticsApi = {
  getDashboardStats: async () => {
    return apiRequest('/analytics/dashboard');
  },

  getLoanMetrics: async () => {
    return apiRequest('/analytics/loans');
  },
};

// Wallet APIs
export const walletApi = {
  getBalance: async () => {
    return apiRequest('/wallet/balance');
  },

  getTransactions: async () => {
    return apiRequest('/wallet/transactions');
  },
};

// User APIs
export const userApi = {
  getProfile: async () => {
    return apiRequest('/user/profile');
  },

  updateProfile: async (profileData: any) => {
    return apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  getKycStatus: async () => {
    return apiRequest('/user/kyc');
  },
};
