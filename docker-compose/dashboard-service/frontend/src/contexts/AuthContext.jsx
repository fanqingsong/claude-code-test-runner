/**
 * AuthContext
 *
 * Provides authentication state and methods throughout the application.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          // Verify token is still valid
          try {
            await authService.ensureValidToken();
            const storedUser = authService.getUser();
            if (storedUser) {
              setUser(storedUser);
            } else {
              // Token exists but no user data, clear it
              authService.clearAuthData();
            }
          } catch (error) {
            // Token is invalid, clear it
            console.log('Token invalid, clearing auth data');
            authService.clearAuthData();
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const unsubscribe = authService.onAuthChange(() => {
      const currentUser = authService.getUser();
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  // Auto-refresh token every minute
  useEffect(() => {
    if (!authService.isAuthenticated()) return;

    const interval = setInterval(async () => {
      try {
        await authService.ensureValidToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        setUser(null);
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  const login = useCallback(async (provider, username, password) => {
    setLoading(true);
    setError(null);

    try {
      let data;
      switch (provider) {
        case 'local':
          data = await authService.loginLocal(username, password);
          break;
        case 'casdoor':
          data = await authService.loginCasdoor(username, password);
          break;
        default:
          throw new Error(`Invalid provider: ${provider}`);
      }

      setUser(data.user);
      return { success: true, data };
    } catch (err) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const loginOidc = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.oidcLogin();
      // OIDC login redirects, so we won't reach here
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'OIDC login failed';
      setError(errorMsg);
      setLoading(false);
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      setUser(null);
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Logout failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
    setLoading(true);
    setError(null);

    try {
      const data = await authService.register(username, email, password);
      return { success: true, data };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const isAdmin = user?.is_admin === true || (user?.roles && user.roles.includes('admin'));

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user || authService.isAuthenticated(),
    isAdmin,
    login,
    loginOidc,
    logout,
    register,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
