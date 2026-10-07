"use client";

// Bildirimler (toast) + ekran okuyucu duyurusu (AccessibilityInfo).
// (frontend/components/providers/ToastProvider.tsx karşılığı.)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CloseIcon } from "@/ui/Icon";
import { SHADOW_POP, fontSize, lineHeight } from "@/theme";
import { useThemeColors } from "@/providers/ThemeProvider";

type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  /** Ekran okuyuculara duyuru (yeni mesaj vb.). */
  announce: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const nextId = useRef(1);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "error") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      timers.current[id] = setTimeout(() => {
        dismiss(id);
        delete timers.current[id];
      }, 5000);
    },
    [dismiss],
  );

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const value = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {/* Toast yığını */}
        <View
          style={styles.overlay}
          pointerEvents="box-none"
          accessibilityRole="alert"
        >
          {toasts.map((t) => {
            const palette =
              t.kind === "error"
                ? {
                    bg: colors.dangerSoftBg,
                    border: colors.dangerSoftBorder,
                    text: colors.dangerSoftText,
                  }
                : t.kind === "success"
                  ? {
                      bg: colors.dark ? "rgba(6, 78, 59, 0.9)" : "#ecfdf5",
                      border: colors.dark
                        ? "rgba(6, 78, 59, 0.6)"
                        : "#a7f3d0",
                      text: colors.dark ? "#a7f3d0" : "#047857",
                    }
                  : {
                      bg: colors.infoSoftBg,
                      border: colors.infoSoftBorder,
                      text: colors.infoSoftText,
                    };
            return (
              <View
                key={t.id}
                style={[
                  styles.toast,
                  SHADOW_POP,
                  { backgroundColor: palette.bg, borderColor: palette.border },
                ]}
              >
                <Text style={[styles.message, { color: palette.text }]}>
                  {t.message}
                </Text>
                <Pressable
                  onPress={() => dismiss(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Bildirimi kapat"
                  hitSlop={8}
                  style={styles.close}
                >
                  <CloseIcon size={16} color={palette.text} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    gap: 8,
    zIndex: 80,
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  close: {
    marginTop: 1,
  },
});