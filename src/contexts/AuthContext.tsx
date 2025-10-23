import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, tokenManager } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  fullName: string;
  walletAddress: string;
  kycVerified: boolean;
  faceVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: any) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    const token = tokenManager.get();
    if (!token) {
      setLoading(false);
      return;
    }

    const response = await authApi.verifyToken();
    if (response.success && response.data) {
      setUser(response.data as User);
    } else {
      tokenManager.remove();
    }
    setLoading(false);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const response = await authApi.login({ email, password });
    
    if (response.success && response.data) {
      const data = response.data as any;
      tokenManager.set(data.token);
      setUser(data.user);
      toast.success('Welcome back!');
      return true;
    } else {
      toast.error(response.error || 'Login failed');
      return false;
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    const response = await authApi.register(userData);
    
    if (response.success && response.data) {
      const data = response.data as any;
      tokenManager.set(data.token);
      setUser(data.user);
      toast.success('Account created successfully!');
      return true;
    } else {
      toast.error(response.error || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
