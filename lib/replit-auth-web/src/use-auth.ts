import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter, type AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const SESSION_TOKEN_STORAGE_KEY = "pokevault.sessionToken";

function getStoredSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAuthTokenGetter(getStoredSessionToken);

    const token = getStoredSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    fetch("/api/auth/user", { credentials: "include", headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const returnTo =
      `${window.location.pathname}${window.location.search}${window.location.hash}` ||
      "/";
    const params = new URLSearchParams({ returnTo });
    window.location.assign(`/api/login?${params.toString()}`);
  }, []);

  const logout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage failures; the server-side logout still clears cookies.
    }
    window.location.assign("/api/logout");
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
