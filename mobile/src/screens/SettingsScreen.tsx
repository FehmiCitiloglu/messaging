"use client";

// Ayarlar: profil kartı, tema tercihi, çıkış.
// (frontend/components/chat/SettingsModal.tsx karşılığı — mobilde modal ekran;
// çıkış onayı Alert ile native diyalog olarak sunulur.)

import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import {
  useTheme,
  useThemeColors,
} from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import { ApiError } from "@/lib/errors";
import { formatJoined } from "@/lib/format";
import { fontSize } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { LogoutIcon, MonitorIcon, MoonIcon, SunIcon } from "@/ui/Icon";
import { ButtonSpinner } from "@/ui/Skeleton";

export function SettingsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  const meName = user?.displayName ?? "";
  const meUsername = user?.username ?? "";
  const meId = user?.id ?? "";

  const options = [
    { value: "system", label: "Sistem", Icon: MonitorIcon },
    { value: "light", label: "Açık", Icon: SunIcon },
    { value: "dark", label: "Koyu", Icon: MoonIcon },
  ] as const;

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      // Yönlendirmeyi (app) grubunun misafir koruması otomatik yapar.
      router.back();
    } catch (err) {
      toast(
        err instanceof ApiError ? err.friendly : "Çıkış yapılamadı, tekrar dene.",
        "error",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    const message =
      "Bu cihazdan çıkış yapmak istediğine emin misin? Yeniden giriş yapman gerekecek.";
    if (Platform.OS === "web") {
      // RN-web'de Alert.inert olduğundan tarayıcı onay diyaloğu kullanılır.
      if (typeof window !== "undefined" && window.confirm(message)) {
        void doLogout();
      }
      return;
    }
    // Web'deki onay modalı yerine native diyalog.
    Alert.alert("Oturumu kapat", message, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış yap",
        style: "destructive",
        onPress: () => void doLogout(),
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.panel }]}>
      {/* Başlık */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 10, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Ayarlar</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          hitSlop={8}
          style={[styles.closeChip, { backgroundColor: colors.panelAlt }]}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            Kapat
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {/* Profil kartı */}
        <View style={styles.profileRow}>
          <Avatar id={meId} name={meName} size="lg" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[styles.profileName, { color: colors.text }]}
            >
              {meName}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.profileUsername, { color: colors.textMuted }]}
            >
              @{meUsername}
            </Text>
            {user?.createdAt ? (
              <Text
                numberOfLines={1}
                style={[styles.joined, { color: colors.textFaint }]}
              >
                {formatJoined(user.createdAt)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Görünüm */}
        <Text style={[styles.legend, { color: colors.text }]}>Görünüm</Text>
        <View style={styles.themeGrid}>
          {options.map(({ value, label, Icon }) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Tema: ${label}`}
                style={({ pressed }) => [
                  styles.themeOption,
                  {
                    backgroundColor: active
                      ? colors.dark
                        ? "rgba(49, 46, 129, 0.4)"
                        : colors.brand50
                      : pressed
                        ? colors.panelAlt
                        : "transparent",
                    borderColor: active ? colors.brand500 : colors.borderStrong,
                  },
                ]}
              >
                <Icon
                  size={20}
                  color={
                    active
                      ? colors.dark
                        ? colors.brand300
                        : colors.brand700
                      : colors.textMuted
                  }
                />
                <Text
                  style={{
                    color: active
                      ? colors.dark
                        ? colors.brand300
                        : colors.brand700
                      : colors.textMuted,
                    fontSize: fontSize.xs,
                    fontWeight: "500",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Çıkış */}
        <Pressable
          onPress={confirmLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Oturumu kapat"
          style={({ pressed }) => [
            styles.logoutButton,
            {
              borderColor: colors.dark
                ? "rgba(127, 29, 29, 0.6)"
                : "#fecaca",
              backgroundColor: pressed
                ? colors.dangerSoftBg
                : "transparent",
            },
          ]}
        >
          {loggingOut ? <ButtonSpinner color={colors.danger} /> : null}
          <LogoutIcon size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: fontSize.sm, fontWeight: "600" }}>
            {loggingOut ? "Çıkış yapılıyor…" : "Oturumu kapat"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  closeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  content: {
    padding: 20,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  profileUsername: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  joined: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  legend: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    marginTop: 24,
    marginBottom: 8,
  },
  themeGrid: {
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    marginTop: 24,
  },
});