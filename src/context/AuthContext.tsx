import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth';
import { UserObj } from '../types/api';

interface AuthContextType {
  user: UserObj | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserObj | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const u = await authService.getUser();
      setUser(u);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    const result = await authService.login(identifier, password);
    if (result.success) {
      await loadUser();
    }
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
