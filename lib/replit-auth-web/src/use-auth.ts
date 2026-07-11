import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter, type AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (password?: string) => Promise<LoginResult>;
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

function setStoredSessionToken(token: string): void {
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  } catch {
    // Cookie auth may still work if storage is unavailable.
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const res = await fetch("/api/auth/user", { credentials: "include", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { user: AuthUser | null };
    return data.user ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAuthTokenGetter(getStoredSessionToken);

    loadUser()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
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
  }, [loadUser]);

  const login = useCallback(async (password?: string): Promise<LoginResult> => {
    const returnTo =
      `${window.location.pathname}${window.location.search}${window.location.hash}` ||
      "/";

    if (!password) {
      return { ok: false, error: "Enter the admin password." };
    }

    const res = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, returnTo }),
    });

    if (res.status === 404) {
      const params = new URLSearchParams({ returnTo });
      window.location.assign(`/api/login?${params.toString()}`);
      return { ok: false };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      return { ok: false, error: data?.error ?? "Sign in failed." };
    }

    const data = await res.json() as {
      sessionToken?: string;
      user?: AuthUser | null;
    };

    if (data.sessionToken) {
      setStoredSessionToken(data.sessionToken);
      setAuthTokenGetter(getStoredSessionToken);
    }

    const currentUser = data.user ?? (await loadUser());
    setUser(currentUser);
    setIsLoading(false);
    return { ok: !!currentUser };
  }, [loadUser]);

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
