// Kök yerleşim: sağlayıcılar + native yığın.
// Yetki akışı: /index duruma göre /chats veya /login'e yönlendirir;
// /chats/_layout.tsx kendi misafir korumasını uygular.

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider, useThemeColors } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* yoksay */
});

function RootStack() {
  const colors = useThemeColors();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      /* yoksay */
    });
  }, []);

  return (
    <>
      <StatusBar style={colors.dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="chats" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}