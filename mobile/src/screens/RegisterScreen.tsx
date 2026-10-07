// Kayıt ekranı (frontend/components/auth/RegisterForm.tsx ile aynı davranış).

import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function RegisterScreen() {
  const { status, register } = useAuth();
  const { toast } = useToast();
  const colors = useThemeColors();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    displayName?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/chats");
  }, [status, router]);

  const usernameOk = useMemo(() => USERNAME_RE.test(username), [username]);

  const onSubmit = async () => {
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!USERNAME_RE.test(username)) {
      errors.username =
        "3-20 karakter; yalnızca küçük harf, rakam ve alt çizgi kullanabilirsin.";
    }
    const dn = displayName.trim();
    if (dn.length < 1 || dn.length > 40) {
      errors.displayName = "Görünen ad 1-40 karakter olmalı.";
    }
    if (password.length < 8) {
      errors.password = "Şifre en az 8 karakter olmalı.";
    }
    if (confirm !== password) {
      errors.confirm = "Şifreler birbiriyle eşleşmiyor.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ username, displayName: dn, password });
      router.replace("/chats");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.friendly
          : "Kayıt oluşturulamadı. Tekrar dene.";
      setFormError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Vira'ya katıl"
      subtitle="Saniyeler içinde hesabını aç, sohbet etmeye başla."
      footer={
        <Text>
          Zaten hesabın var mı?{" "}
          <Text
            onPress={() => router.push("/login")}
            accessibilityRole="link"
            style={{
              color: colors.dark ? colors.brand300 : colors.brand600,
              fontWeight: "600",
              fontSize: fontSize.sm,
            }}
          >
            Giriş yap
          </Text>
        </Text>
      }
    >
      <View style={styles.form}>
        <FormErrorBanner message={formError} />

        <View>
          <AppInput
            label="Kullanıcı adı"
            value={username}
            onChangeText={(t) =>
              setUsername(t.toLocaleLowerCase("tr-TR"))
            }
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            textContentType="username"
            placeholder="ornekkullanici"
            error={
              username.length > 0 && !usernameOk ? fieldErrors.username : undefined
            }
            help={`3-20 karakter · küçük harf, rakam ve alt çizgi (${username.length}/20)`}
          />
        </View>

        <AppInput
          label="Görünen ad"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          placeholder="Ayşe Yılmaz"
          maxLength={40}
          error={fieldErrors.displayName}
        />

        <View>
          <AppInput
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="En az 8 karakter"
            error={fieldErrors.password}
            help="En az 8 karakter"
          />
          {/* Şifre gücü göstergesi */}
          <View style={styles.strengthRow} accessibilityElementsHidden>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      password.length >= (i + 1) * 3
                        ? colors.brand500
                        : colors.dark
                          ? "#334155"
                          : "#e2e8f0",
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <AppInput
          label="Şifre (tekrar)"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••"
          error={fieldErrors.confirm}
        />

        <PrimaryButton
          label="Hesap oluştur"
          busyLabel="Hesap oluşturuluyor…"
          busy={submitting}
          onPress={() => void onSubmit()}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  strengthRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
});