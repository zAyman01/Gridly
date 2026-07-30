import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authApi } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  isAuth: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("gridly_accessToken");
    if (!token) { setIsLoading(false); return; }
    authApi
      .me()
      .then((u) => setUser(u as User))
      .catch(() => localStorage.removeItem("gridly_accessToken"))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem("gridly_accessToken", data.accessToken);
    setUser(data.user as User);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.signup({ name, email, password });
    localStorage.setItem("gridly_accessToken", data.accessToken);
    setUser(data.user as User);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem("gridly_accessToken");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuth: !!user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
