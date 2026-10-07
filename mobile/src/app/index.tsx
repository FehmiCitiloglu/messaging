// Ana rota: oturum durumuna göre yönlendirme.

import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useThemeColors } from "@/providers/ThemeProvider";
import { fontSize } from "@/theme";

export default function Index() {
  const { status } = useAuth();
  const colors = useThemeColors();

  if (status === "loading") {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.brand500} />
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 16 }}>
          Oturumun doğrulanıyor…
        </Text>
      </View>
    );
  }

  return <Redirect href={status === "authed" ? "/chats" : "/login"} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});