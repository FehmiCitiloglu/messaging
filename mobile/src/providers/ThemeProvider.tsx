"use client";

// Tema: AsyncStorage("theme") → light | dark | system.
// (frontend/components/providers/ThemeProvider.tsx karşılığı; RN Appearance +
// useColorScheme ile sistem tercihi izlenir, renk çözümü useThemeColors ile.)

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  type ThemeColors,
} from "@/theme";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const systemScheme = useColorScheme();
  // Sistem tercihi doğrudan türetilir (efekt içinde setState yok).
  const systemPreference: "light" | "dark" =
    systemScheme === "dark" ? "dark" : "light";

  // Kayıtlı tercihi oku.
  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") setModeState(stored);
      } catch {
        /* yoksay */
      }
    })();
  }, []);

  const resolved: "light" | "dark" =
    mode === "system" ? systemPreference : mode;

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void (async () => {
      try {
        if (next === "system") await AsyncStorage.removeItem(STORAGE_KEY);
        else await AsyncStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* yoksay */
      }
    })();
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      colors: resolved === "dark" ? darkColors : lightColors,
      setMode,
      toggle,
    }),
    [mode, resolved, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme, ThemeProvider içinde kullanılmalıdır.");
  return ctx;
}

/** Çözümlenmiş tema renkleri (en sık kullanılan kısayol). */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}