'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  canAccessBackend: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  user: null,
  canAccessBackend: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  user: AuthUser | null;
  canAccessBackend: boolean;
}

export function AuthProvider({ children, isAuthenticated, user, canAccessBackend }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ isAuthenticated, user, canAccessBackend }}>
      {children}
    </AuthContext.Provider>
  );
}
