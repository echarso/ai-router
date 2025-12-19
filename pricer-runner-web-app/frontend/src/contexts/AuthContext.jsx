import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Keycloak from 'keycloak-js';

const AuthContext = createContext(null);

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || `${window.location.origin}/keycloak`;
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'bestai';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'platform-frontend';

export function AuthProvider({ children }) {
  const [keycloak, setKeycloak] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const keycloakRef = useRef(null);
  const initPromiseRef = useRef(null);
  const initOnceRef = useRef(false);

  const initKeycloak = useCallback(() => {
    const keycloakInstance = new Keycloak({
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: KEYCLOAK_CLIENT_ID,
    });

    keycloakInstance.onTokenExpired = () => {
      console.log('Token expired, refreshing...');
      keycloakInstance.updateToken(30).catch((err) => {
        console.error('Failed to refresh token:', err);
        setAuthenticated(false);
        setUser(null);
      });
    };

    keycloakInstance.onAuthError = (error) => {
      console.error('Keycloak auth error:', error);
      setError(error);
      setAuthenticated(false);
      setUser(null);
      setLoading(false);
    };

    keycloakInstance.onInitError = (error) => {
      console.error('Keycloak initialization error:', error);
      setError(error);
      setLoading(false);
    };

    return keycloakInstance;
  }, []);

  useEffect(() => {
    // One instance, one init.
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const hasKeycloakParams =
      urlParams.has('code') || urlParams.has('state') || urlParams.has('session_state');

    const kc = initKeycloak();
    keycloakRef.current = kc;
    setKeycloak(kc);

    // IMPORTANT: init() sets up the adapter; without it, kc.login() can throw "adapter is undefined".
    // Using check-sso here does NOT redirect; it only checks if a session already exists.
    initPromiseRef.current = kc
      .init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      })
      .then((isAuthed) => {
        setAuthenticated(isAuthed);
        setUser(isAuthed ? kc.tokenParsed : null);

        // If we came back from Keycloak, clear OAuth params AFTER init processed them.
        if (hasKeycloakParams) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        return isAuthed;
      })
      .catch((err) => {
        console.error('Keycloak init failed:', err);
        setError(err);
        setAuthenticated(false);
        setUser(null);
        return false;
      })
      .finally(() => {
        setLoading(false);
      });
  }, [initKeycloak]);

  const login = useCallback(async () => {
    try {
      const kc = keycloakRef.current || keycloak;
      if (!kc) throw new Error('Keycloak not initialized');

      // Ensure init() finished so the adapter exists before calling login().
      if (initPromiseRef.current) {
        await initPromiseRef.current;
      }

      const redirectUri = window.location.origin + window.location.pathname;

      // 🚀 THIS WILL REDIRECT TO KEYCLOAK
      kc.login({
        redirectUri,
      });
    } catch (err) {
      console.error('Login failed:', err);
      setError(err);
      throw err;
    }
  }, [keycloak, initKeycloak]);

  const logout = useCallback(() => {
    if (keycloak) {
      keycloak.logout();
      setAuthenticated(false);
      setUser(null);
    }
  }, [keycloak]);

  const getToken = useCallback(async () => {
    if (!keycloak || !authenticated) {
      return null;
    }

    try {
      // Refresh token if it expires within 60 seconds
      if (keycloak.isTokenExpired(60)) {
        await keycloak.updateToken(60);
      }
      return keycloak.token;
    } catch (error) {
      console.error('Failed to get token:', error);
      setAuthenticated(false);
      setUser(null);
      return null;
    }
  }, [keycloak, authenticated]);

  const hasRole = useCallback((role) => {
    if (!user || !user.realm_access) {
      return false;
    }
    return user.realm_access.roles?.includes(role) || false;
  }, [user]);

  const isSystemOwner = useCallback(() => {
    return hasRole('system-owner');
  }, [hasRole]);

  const isSystemAdmin = useCallback(() => {
    // system-owner is treated as SA too (backwards compat)
    return hasRole('system-admin') || hasRole('system-owner');
  }, [hasRole]);

  const isOrganizationAdmin = useCallback(() => {
    return hasRole('organization-admin');
  }, [hasRole]);

  const isProjectAdmin = useCallback(() => {
    return hasRole('project-admin');
  }, [hasRole]);

  const value = {
    keycloak,
    authenticated,
    loading,
    user,
    error,
    login,
    logout,
    getToken,
    hasRole,
    isSystemOwner,
    isSystemAdmin,
    isOrganizationAdmin,
    isProjectAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
