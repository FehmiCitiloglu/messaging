// Giriş ekranı (frontend/components/auth/LoginForm.tsx ile aynı davranış).

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AppInput,
  AuthShell,
  FormErrorBanner,
  PrimaryButton,
} from "@/components/auth/AuthShell";
import { ApiError } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/providers/ThemeProvider";
import { fontSize } from "@/theme";

export default function LoginScreen() {
  const { status, login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Zaten giriş yapılmışsa sohbete git.
  useEffect(() => {
    if (status === "authed") router.replace("/chats");
  }, [status, router]);

  const onSubmit = async () => {
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!username.trim()) errors.username = "Kullanıcı adı gerekli.";
    if (!password) errors.password = "Şifre gerekli.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ username: username.trim().toLowerCase(), password });
      router.replace("/chats");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.friendly : "Giriş yapılamadı. Tekrar dene.";
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Tekrar hoş geldin"
      subtitle="Sohbetlerine kaldığın yerden devam et."
      footer={
        <FooterText
          lead="Henüz hesabın yok mu? "
          action="Hemen kayıt ol"
          onPress={() => router.push("/register")}
        />
      }
    >
      <View style={styles.form}>
        <FormErrorBanner message={formError} />

        <AppInput
          label="Kullanıcı adı"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          textContentType="username"
          placeholder="ornekkullanici"
          error={fieldErrors.username}
        />

        <AppInput
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          error={fieldErrors.password}
        />

        <PrimaryButton
          label="Giriş yap"
          busyLabel="Giriş yapılıyor…"
          busy={submitting}
          onPress={() => void onSubmit()}
        />
      </View>
    </AuthShell>
  );
}

function FooterText({
  lead,
  action,
  onPress,
}: {
  lead: string;
  action: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Text>
      {lead}
      <Text
        onPress={onPress}
        accessibilityRole="link"
        style={{
          color: colors.dark ? colors.brand300 : colors.brand600,
          fontWeight: "600",
          fontSize: fontSize.sm,
        }}
      >
        {action}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
});