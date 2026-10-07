// Sohbet ekranlarının kabuğu: yetki koruması + kalıcı sohbet durumu.
// (frontend/components/chat/ChatShell.tsx'nin mobil karşılığı.)

import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { ChatStoreProvider } from "@/providers/ChatStore";
import { useThemeColors } from "@/providers/ThemeProvider";
import { fontSize } from "@/theme";

export default function ChatsLayout() {
  const colors = useThemeColors();
  const { status, user } = useAuth();

  // Yetki koruması: oturum geri yükleme bitti ve kullanıcı misafir → /login.
  if (status === "loading" || (status === "authed" && !user)) {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.brand500} />
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.sm,
            marginTop: 16,
          }}
        >
          Oturumun doğrulanıyor…
        </Text>
      </View>
    );
  }
  if (status === "guest" || !user) {
    return <Redirect href="/login" />;
  }

  return (
    <ChatStoreProvider meId={user.id}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
        <Stack.Screen
          name="new"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: "modal" }}
        />
      </Stack>
    </ChatStoreProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});