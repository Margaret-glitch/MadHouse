import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  MadHouseUser,
  checkAuthSession,
  loginMadHouse,
  registerMadHouse,
  logoutMadHouse
} from '../services/madhouseAuth';

export interface SubscriptionRecord {
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  reference: string;
  status: 'active' | 'expired' | 'none';
  entitlement: boolean;
  startDate: string;
  expiryDate: string;
  daysLeft: number;
  updatedAt: string;
}

interface AuthContextType {
  user: MadHouseUser | null;
  subscription: SubscriptionRecord | null;
  isVip: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<MadHouseUser>;
  register: (email: string, password: string, name?: string) => Promise<MadHouseUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshSubscription: () => Promise<SubscriptionRecord | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MadHouseUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscription = useCallback(async (targetUser?: MadHouseUser | null) => {
    const active = targetUser !== undefined ? targetUser : user;
    if (!active) {
      setSubscription(null);
      return null;
    }
    try {
      const userKey = (active.id || active.email).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const res = await fetch(`https://storage.breacher.name.ng/U6op8Nr462Z46tBgxa2COUnja5z1/madhouse-db/userData/subscription_${userKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'active' && data.entitlement) {
          setSubscription(data);
          return data;
        }
      }
      setSubscription(null);
      return null;
    } catch (err) {
      setSubscription(null);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshSubscription(user);
    } else {
      setSubscription(null);
    }
  }, [user, refreshSubscription]);

  // Standard session check that runs immediately when the page loads
  const refreshSession = useCallback(async () => {
    try {
      const activeUser = await checkAuthSession();
      setUser(activeUser);
    } catch (err) {
      console.error('Session refresh failed:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    // Listen to window load / DOMContentLoaded if still loading
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', refreshSession);
      return () => window.removeEventListener('DOMContentLoaded', refreshSession);
    }
  }, [refreshSession]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await loginMadHouse(email, password);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegister = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const registered = await registerMadHouse(email, password, name);
      setUser(registered);
      return registered;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutMadHouse();
    } finally {
      setUser(null);
      setSubscription(null);
      try {
        localStorage.removeItem('madhouse_user');
        localStorage.removeItem('madhouse_active_sub');
        localStorage.removeItem('popcorn_user_account');
      } catch {}
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isVip: Boolean(user && subscription && subscription.status === 'active' && subscription.entitlement),
        isLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        refreshSession,
        refreshSubscription
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
