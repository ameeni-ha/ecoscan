import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

import { apiUrl } from "../utils/apiUrls";

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "ecoscan.auth.token";
const USER_STORAGE_KEY = "ecoscan.auth.user";

const getStoredUser = () => {
  const value = sessionStorage.getItem(USER_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    sessionStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const saveSession = (token, user) => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

const clearSession = () => {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

const request = async (path, options = {}) => {
  let response;

  try {
    response = await fetch(apiUrl(path), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    throw new Error(
      "Impossible de contacter le serveur. Ouvrez un second terminal puis lancez: npm run api (port 4000)."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Une erreur est survenue");
  }

  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [isReady, setIsReady] = useState(false);

  const applySession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    saveSession(nextToken, nextUser);
  }, []);

  const resetSession = useCallback(() => {
    setToken(null);
    setUser(null);
    clearSession();
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await request("/auth/refresh", {
      method: "POST",
    });

    applySession(data.token, data.user);
    return data;
  }, [applySession]);

  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        resetSession();
        setIsReady(true);
        return;
      }

      try {
        const data = await request("/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        applySession(token, data.user);
      } catch (error) {
        try {
          await refreshSession();
        } catch (refreshError) {
          resetSession();
        }
      } finally {
        setIsReady(true);
      }
    };

    restoreSession();
  }, [applySession, refreshSession, resetSession, token]);

  const login = useCallback(async (email, password) => {
    if (!email || !password) {
      throw new Error("Email et mot de passe requis");
    }

    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    applySession(data.token, data.user);
    return data.user;
  }, [applySession]);

  const register = useCallback(
    async (payload) => {
      const { firstName, lastName, email, password } = payload;

      if (!firstName || !lastName || !email || !password) {
        throw new Error("Merci de remplir tous les champs obligatoires");
      }

      const data = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      applySession(data.token, data.user);
      return data.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await request("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      // If the API is unavailable, we still clear the local session.
    } finally {
      resetSession();
    }
  }, [resetSession]);

  const logoutAll = useCallback(async () => {
    if (!token) {
      resetSession();
      return;
    }

    try {
      await request("/auth/logout-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      // If the API is unavailable, we still clear the local session.
    } finally {
      resetSession();
    }
  }, [resetSession, token]);

  const updateUser = useCallback(
    (nextUser) => {
      if (!token || !nextUser) return;
      applySession(token, nextUser);
    },
    [applySession, token]
  );

  const value = {
    isAuthenticated: Boolean(user && token),
    isReady,
    user,
    token,
    login,
    register,
    refreshSession,
    logout,
    logoutAll,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return ctx;
};

