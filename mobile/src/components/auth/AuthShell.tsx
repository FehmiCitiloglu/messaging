"use client";

// Giriş / kayıt ekranlarının ortak zarfı: marka, degrade fon, kart.
// (frontend/components/auth/AuthShell.tsx karşılığı.)

import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHADOW_POP, SHADOW_SOFT, fontSize, lineHeight } from "@/theme";
import { useThemeColors } from "@/providers/ThemeProvider";
import { ButtonSpinner } from "@/ui/Skeleton";
import { LogoMark } from "@/ui/Icon";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dekoratif degrade lekeler */}
        <View
          pointerEvents="none"
          style={[
            styles.blobTop,
            {
              backgroundColor: colors.dark
                ? "rgba(67, 56, 202, 0.2)"
                : "rgba(165, 180, 252, 0.3)",
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.blobBottom,
            {
              backgroundColor: colors.dark
                ? "rgba(112, 26, 117, 0.2)"
                : "rgba(232, 121, 249, 0.25)",
            },
          ]}
        />

        <View style={styles.center}>
          <View style={styles.brandBlock}>
            <LinearGradient
              colors={[ "#6366f1", "#d946ef" ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoTile, SHADOW_POP]}
            >
              <LogoMark size={24} color="#ffffff" />
            </LinearGradient>
            <Text
              style={[
                styles.kicker,
                { color: colors.dark ? colors.brand300 : colors.brand600 },
              ]}
            >
              Vira
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              SHADOW_SOFT,
              {
                backgroundColor: colors.dark
                  ? "rgba(18, 20, 29, 0.85)"
                  : "rgba(255, 255, 255, 0.9)",
                borderColor: colors.dark ? colors.border : "#e2e8f0cc",
              },
            ]}
          >
            {children}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {footer}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FieldError({ message }: { message?: string }) {
  const colors = useThemeColors();
  if (!message) return null;
  return (
    <Text
      accessibilityRole="alert"
      style={[styles.fieldError, { color: colors.danger }]}
    >
      {message}
    </Text>
  );
}

interface AppInputProps extends TextInputProps {
  label: string;
  error?: string;
  help?: string;
}

/** Etiketli metin girişi (web'deki inputClass ile aynı görsel dil). */
export function AppInput({
  label,
  error,
  help,
  style,
  ...rest
}: AppInputProps) {
  const colors = useThemeColors();
  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: error ? colors.danger : colors.borderStrong,
            color: colors.text,
          },
          style,
        ]}
        accessibilityLabel={label}
        {...rest}
      />
      {help ? (
        <Text style={[styles.help, { color: colors.textMuted }]}>{help}</Text>
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

/** Form hataları için kırmızı bilgi kutusu. */
export function FormErrorBanner({ message }: { message?: string | null }) {
  const colors = useThemeColors();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.formError,
        {
          backgroundColor: colors.dangerSoftBg,
          borderColor: colors.dangerSoftBorder,
        },
      ]}
    >
      <Text style={{ color: colors.dangerSoftText, fontSize: fontSize.sm }}>
        {message}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  busyLabel,
  busy = false,
  disabled = false,
  onPress,
  tone = "brand",
}: {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  tone?: "brand" | "danger" | "outlineDanger";
}) {
  const colors = useThemeColors();
  const inactive = disabled || busy;

  const bg =
    tone === "brand"
      ? inactive
        ? colors.dark
          ? "#334155"
          : "#cbd5e1"
        : colors.brand600
      : tone === "danger"
        ? inactive
          ? "#b91c1c99"
          : "#dc2626"
        : "transparent";

  const fg =
    tone === "outlineDanger" ? colors.danger : colors.onBrand;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={busy && busyLabel ? busyLabel : label}
      style={({ pressed }) => [
        styles.button,
        tone === "outlineDanger" && {
          borderWidth: 1,
          borderColor: colors.dark
            ? "rgba(127, 29, 29, 0.6)"
            : "#fecaca",
        },
        { backgroundColor: bg, opacity: pressed && !inactive ? 0.9 : 1 },
      ]}
    >
      {busy ? <ButtonSpinner color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  blobTop: {
    position: "absolute",
    top: -128,
    left: -96,
    width: 384,
    height: 384,
    borderRadius: 999,
  },
  blobBottom: {
    position: "absolute",
    right: -112,
    bottom: -128,
    width: 416,
    height: 416,
    borderRadius: 999,
  },
  center: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
  },
  brandBlock: {
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  logoTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: {
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight["2xl"],
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 24,
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textAlign: "center",
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.base,
    minHeight: 44,
  },
  help: {
    fontSize: fontSize.xs,
    marginTop: 6,
  },
  fieldError: {
    fontSize: fontSize.xs,
    marginTop: 6,
  },
  formError: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
  },
  buttonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});