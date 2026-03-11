import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  const getRefreshToken = () => (typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null);

  const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const storeTokens = (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  };

  // Attempt silent token refresh
  const tryRefresh = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const { accessToken } = await authApi.refresh(refreshToken);
      localStorage.setItem('accessToken', accessToken);
      return accessToken;
    } catch {
      clearTokens();
      return null;
    }
  }, []);

  // Validate stored access token on mount
  useEffect(() => {
    async function init() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await authApi.getMe(token);
        setUser(user);
      } catch {
        // Try refresh if access token is invalid
        const newToken = await tryRefresh();
        if (newToken) {
          try {
            const { user } = await authApi.getMe(newToken);
            setUser(user);
          } catch {
            clearTokens();
          }
        }
      }
      setLoading(false);
    }
    init();
  }, [tryRefresh]);

  const login = async (email, password) => {
    const { user, accessToken, refreshToken } = await authApi.login(email, password);
    storeTokens(accessToken, refreshToken);
    setUser(user);
    return user;
  };

  const register = async (email, password, name) => {
    await authApi.register(email, password, name);
    return login(email, password);
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try { await authApi.logout(refreshToken); } catch {}
    clearTokens();
    setUser(null);
  };

  const refreshUser = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const { user } = await authApi.getMe(token);
      setUser(user);
    } catch {}
  };

  const updateUser = async (data) => {
    const token = getToken();
    const { user: updated } = await authApi.updateMe(data, token);
    setUser(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshUser,
      updateUser,
      tryRefresh,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
